import { Global, Module } from '@nestjs/common';
import { ReferralService } from './referrals.service';

@Global()
@Module({
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralsModule {}
