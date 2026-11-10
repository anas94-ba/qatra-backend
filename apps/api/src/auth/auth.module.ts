import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { env } from '../config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CaptchaService } from './captcha.service';
import { JwtAuthGuard, RolesGuard } from './guards';
import { JwtStrategy } from './jwt.strategy';

@Global()
@Module({
  imports: [PassportModule, JwtModule.registerAsync({ useFactory: () => ({ secret: env.jwtSecret, signOptions: { algorithm: 'HS256', expiresIn: env.accessTtlSeconds } }) })],
  controllers: [AuthController],
  providers: [
    AuthService, CaptchaService, JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
