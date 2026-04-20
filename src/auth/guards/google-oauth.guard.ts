import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleOauthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const referralCode = typeof request.query?.referralCode === 'string' ? request.query.referralCode : undefined;
    const statePayload = referralCode ? JSON.stringify({ referralCode }) : undefined;

    return {
      scope: ['email', 'profile'],
      session: false,
      state: statePayload,
      prompt: 'select_account',
    };
  }
}
