import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { SocialAuthRequestUser } from '../auth.types';

@Injectable()
export class GoogleOauthStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') ?? '',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? 'unused',
      callbackURL: `${config.get<string>('API_PUBLIC_URL') ?? 'https://sentinel-api-qh4y.onrender.com'}/auth/google/callback`,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value?.toLowerCase();

    if (!email || !profile.id) {
      return done(
        new UnauthorizedException('Google account is missing required profile data'),
        false,
      );
    }

    let referralCode: string | undefined;
    if (typeof req.query?.state === 'string' && req.query.state) {
      try {
        const parsed = JSON.parse(req.query.state) as { referralCode?: string };
        referralCode = parsed.referralCode;
      } catch {
        referralCode = undefined;
      }
    }

    const user: SocialAuthRequestUser = {
      providerUserId: profile.id,
      email,
      name: profile.displayName || email.split('@')[0],
      ...(referralCode ? { referralCode } : {}),
    };

    done(null, user);
  }
}
