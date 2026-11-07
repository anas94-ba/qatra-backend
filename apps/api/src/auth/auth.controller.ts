import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AllowAnyState, CurrentUser, Public } from '../common/decorators';
import { AuthUser } from '../common/types';
import { AuthService } from './auth.service';
import { ChangePasswordDto, EmailDto, LoginDto, RefreshDto, RegisterDto, ResetPasswordDto, VerifyEmailDto } from './dto';

const strict = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  /** The only public write endpoint: rate limit + CAPTCHA (TC23) */
  @Public() @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Public() @Throttle(strict) @HttpCode(200)
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) { return this.auth.verifyEmail(dto.token); }

  @Public() @Throttle(strict) @HttpCode(200)
  @Post('resend-verification')
  resend(@Body() dto: EmailDto) { return this.auth.resendVerification(dto.email); }

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) { return this.auth.login(dto.email, dto.password); }

  @Public() @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken); }

  @Public() @HttpCode(200)
  @Post('logout')
  logout(@Body() dto: RefreshDto) { return this.auth.logout(dto.refreshToken); }

  @ApiBearerAuth() @AllowAnyState()
  @Get('me')
  me(@CurrentUser() u: AuthUser) { return this.auth.me(u.id); }

  @ApiBearerAuth() @AllowAnyState() @HttpCode(200)
  @Post('change-password')
  changePassword(@CurrentUser() u: AuthUser, @Body() dto: ChangePasswordDto) { return this.auth.changePassword(u.id, dto.currentPassword, dto.newPassword); }

  @Public() @Throttle(strict) @HttpCode(200)
  @Post('forgot-password')
  forgot(@Body() dto: EmailDto) { return this.auth.forgotPassword(dto.email); }

  @Public() @Throttle(strict) @HttpCode(200)
  @Post('reset-password')
  reset(@Body() dto: ResetPasswordDto) { return this.auth.resetPassword(dto.token, dto.newPassword, dto.newPasswordConfirm); }
}
