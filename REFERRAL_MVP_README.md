# Simple Referral MVP Notes

## Goal

This version replaces the heavy referral reward system with a lighter MVP that fits a free-plan deployment.

Instead of:
- `3 referrals => PRO for 1 month`

We now do:
- `1 successful referral => +1 bonus tracking slot`
- bonus slots are capped so usage does not grow without control

This is safer for a limited production environment because it does not unlock unlimited scraping or expensive background work.

## Why We Simplified It

The older version was stronger architecturally, but it had more moving parts:
- `Referral` table
- referral statuses
- subscription activation logic
- subscription expiry logic
- extra modules for billing/plans

That design is okay later, but for your current budget and hosting limits it was too much.

The new version keeps only the parts you really need:
- every user gets a `referral_code`
- a new user can sign up with someone else's code
- when that invited user tracks their first product, the inviter gets `+1` slot
- max bonus slots = `3`

## Data Model

### `Tenant`
We added:

```prisma
bonus_tracking_slots Int @default(0)
```

Why?
Because tracking limits are checked at tenant level in your app, so the extra slots should live there too.

### `User`
We kept and added:

```prisma
referral_code         String   @unique
referred_by_user_id   String?
referral_qualified_at DateTime?
```

Why?
- `referral_code`: each user has a code to share
- `referred_by_user_id`: stores who invited this user
- `referral_qualified_at`: tells us whether this user already counted as a successful referral

This field prevents duplicate rewards.

## Registration Flow

File: `src/auth/auth.service.ts`

Main idea:
1. user sends optional `referralCode`
2. backend normalizes it
3. backend checks that the code exists
4. backend creates the new user
5. if a referral code was provided, we store `referred_by_user_id`

Important part:

```ts
const normalizedReferralCode = this.referrals.normalizeReferralCode(dto.referralCode);
const referrer = normalizedReferralCode
  ? await this.referrals.assertValidReferralCode(normalizedReferralCode)
  : null;
```

Then during user creation:

```ts
const newUser = await tx.user.create({
  data: {
    email: dto.email,
    password_hash: passwordHash,
    referral_code: referralCode,
    referred_by_user_id: referrer?.id ?? null,
    tenant_id: tenant.id,
    role: 'OWNER',
  },
});
```

## Referral Code Generation

Still inside `src/auth/auth.service.ts`:

```ts
private async generateUniqueReferralCode(length = 10): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const bytes = randomBytes(length);
    const referralCode = Array.from(bytes, (byte) =>
      REFERRAL_CODE_ALPHABET[byte % REFERRAL_CODE_ALPHABET.length],
    ).join('');

    const existingUser = await this.prisma.user.findUnique({
      where: { referral_code: referralCode },
      select: { id: true },
    });

    if (!existingUser) {
      return referralCode;
    }
  }

  throw new InternalServerErrorException('Unable to generate a unique referral code');
}
```

Why this way?
- we generate a random readable code
- we still check the database for uniqueness
- we retry safely if there is a collision

## When Does a Referral Become Successful?

File: `src/referrals/referrals.service.ts`

We do **not** reward on signup.
We reward only when the invited user creates their **first tracked item**.

That logic is triggered from `src/tracking/tracking.service.ts`:

```ts
await this.referrals.processReferralQualification(userId);
```

Inside `processReferralQualification()`:

```ts
const referredUser = await tx.user.findUnique({
  where: { id: referredUserId },
  select: {
    referred_by_user_id: true,
    referral_qualified_at: true,
  },
});
```

We stop if:
- the user was not referred
- or this referral was already counted before

Then we check tracked items count:

```ts
const trackedItemsCount = await tx.trackedItem.count({
  where: { user_id: referredUserId },
});

if (trackedItemsCount !== 1) {
  return;
}
```

Why `=== 1`?
Because that means this is the **first real tracking action**.
That gives you a better signal than just signup.

Then we mark the referral as counted:

```ts
await tx.user.update({
  where: { id: referredUserId },
  data: {
    referral_qualified_at: new Date(),
  },
});
```

And reward the inviter:

```ts
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
```

This cap protects you from unlimited growth.

## Tracking Limit Logic

File: `src/tracking/tracking.service.ts`

Before creating a tracked item, we read:
- tenant plan
- tenant bonus slots
- current tracked items count

```ts
const [tenant, trackedItemsCount] = await Promise.all([
  this.prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: {
      plan: true,
      bonus_tracking_slots: true,
    },
  }),
  this.prisma.trackedItem.count({ where: { tenant_id: tenantId } }),
]);
```

Then we compute the limit:

```ts
const trackingLimit =
  tenant.plan === 'PRO'
    ? Number.POSITIVE_INFINITY
    : FREE_TRACKED_ITEMS_LIMIT + tenant.bonus_tracking_slots;
```

This means:
- free user starts with `5`
- each successful referral adds `+1`
- maximum extra bonus is `3`
- so free user can reach up to `8`

## Referral Summary Endpoint

File: `src/auth/auth.controller.ts`

We kept a lightweight endpoint:

```ts
@Get('referral-summary')
async getReferralSummary(@CurrentUser('id') userId: string) {
  return this.referrals.getReferralSummary(userId);
}
```

The service returns data like:
- `referralCode`
- `successfulReferrals`
- `bonusTrackingSlots`
- `baseTrackingLimit`
- `totalTrackingLimit`
- `maxBonusTrackingSlots`

This is enough for your frontend to show the user:
- their code
- how many successful invites they already have
- how many tracking slots they unlocked

## Files Changed

Core files:
- `prisma/schema.prisma`
- `prisma/migrations/20260416090000_add_simple_referrals/migration.sql`
- `src/auth/dto/register.dto.ts`
- `src/auth/auth.service.ts`
- `src/auth/auth.controller.ts`
- `src/referrals/referrals.service.ts`
- `src/referrals/referrals.module.ts`
- `src/tracking/tracking.service.ts`
- `src/plans/plan.constants.ts`
- `src/app.module.ts`

Removed because they were no longer needed for the simple MVP:
- billing activation service for referral rewards
- heavy plan resolution service
- heavy referral status/reward flow

## Why This Version Is Better For You Right Now

Because your project may run on a free tier, this version is safer:
- no paid-plan activation logic
- no one-month PRO reward
- no subscription expiry logic
- no unlimited usage unlock
- no extra referral table
- fewer moving parts
- easier to debug and maintain

## What You Still Need To Do

Apply the migration to the real database.

Typical command:

```bash
npx prisma migrate dev
```

If you are deploying directly to production later, use your production-safe Prisma migration flow.

## Mental Model To Remember

Think of the system like this:

- signup with referral code -> store who invited the user
- first real tracked product -> count that referral once
- count once only -> use `referral_qualified_at`
- reward inviter -> `bonus_tracking_slots += 1`
- enforce limit -> `FREE_LIMIT + bonus_tracking_slots`

That is the whole idea.

## Final Advice

This MVP is intentionally small.
That is a good thing.

Small systems are easier to:
- ship
- understand
- debug
- trust in production

When your traffic and budget improve later, you can evolve this into a bigger referral system if you really need it.
