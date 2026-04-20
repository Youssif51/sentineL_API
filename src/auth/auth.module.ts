import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleOauthStrategy } from './strategies/google-oauth.strategy';
import { GoogleOauthGuard } from './guards/google-oauth.guard';
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      global: true,
    }),
    PrismaModule,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleOauthStrategy,
    GoogleOauthGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
