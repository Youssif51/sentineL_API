import { BadRequestException, Injectable } from '@nestjs/common';
import { FREE_TRACKED_ITEMS_LIMIT, MAX_BONUS_TRACKING_SLOTS } from '../plans/plan.constants';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReferralService {
  constructor(private prisma: PrismaService) {}

  normalizeReferralCode(referralCode?: string | null): string | null {
    if (!referralCode) {
      return null;
    }

    return referralCode.trim().toUpperCase();
  }

  async assertValidReferralCode(referralCode: string) {   
    const referrer = await this.prisma.user.findUnique({
      where: { referral_code: referralCode },
      select: {
        id: true,
        email: true,
      },
    });

    if (!referrer) {
      throw new BadRequestException('Invalid referral code');
    }

    return referrer;
  }

  async getReferralSummary(userId: string) {
    const [user, successfulReferrals] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          referral_code: true,
          tenant: {
            select: {
              bonus_tracking_slots: true,
              plan: true,
            },
          },
        },
      }),
      this.prisma.user.count({
        where: {
          referred_by_user_id: userId,
          referral_qualified_at: { not: null },
        },
      }),
    ]);

      return {
        referralCode: user.referral_code,
        successfulReferrals,
        bonusTrackingSlots: user.tenant.bonus_tracking_slots,
        baseTrackingLimit: user.tenant.plan === 'PRO' ? null : FREE_TRACKED_ITEMS_LIMIT,
        totalTrackingLimit:
          user.tenant.plan === 'PRO'
            ? null
            : FREE_TRACKED_ITEMS_LIMIT + user.tenant.bonus_tracking_slots,
        maxBonusTrackingSlots: MAX_BONUS_TRACKING_SLOTS,
      };
  }

  async processReferralQualification(referredUserId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const referredUser = await tx.user.findUnique({
        where: { id: referredUserId },
        select: {
          referred_by_user_id: true,
          referral_qualified_at: true,
        },
      });

      if (
        !referredUser ||
        !referredUser.referred_by_user_id ||
        referredUser.referral_qualified_at
      ) {
        return;
      }

      const trackedItemsCount = await tx.trackedItem.count({
        where: { user_id: referredUserId },
      });

      if (trackedItemsCount !== 1) {
        return;
      }

      const referrer = await tx.user.findUnique({
        where: { id: referredUser.referred_by_user_id },
        select: {
          tenant_id: true,
          tenant: {
            select: {
              bonus_tracking_slots: true,
            },
          },
        },
      });

      if (!referrer) {
        return;
      }

      await tx.user.update({
        where: { id: referredUserId },
        data: {
          referral_qualified_at: new Date(),
        },
      });

      if (referrer.tenant.bonus_tracking_slots < MAX_BONUS_TRACKING_SLOTS) {
        await tx.tenant.update({
          where: { id: referrer.tenant_id },
          data: {
            bonus_tracking_slots: {
              increment: 1,
            },
          },
        });
      }
    });
  }
}
