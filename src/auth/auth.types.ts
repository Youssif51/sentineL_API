export interface SocialProfile {
  providerUserId: string;
  email: string;
  name: string;
}

export interface SocialAuthRequestContext {
  referralCode?: string;
}

export interface SocialAuthRequestUser extends SocialProfile, SocialAuthRequestContext {}
