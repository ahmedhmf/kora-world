import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response, Request } from 'express';
import { AuthGuard } from './auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() body: any,
    @Res({ passthrough: true }) response: any,
  ) {
    const result = await this.authService.login(body.email, body.password);

    // Set HttpOnly JWT cookie
    response.cookie('kora_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Support local dev and dynamic requests
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    return {
      user: result.user,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Res({ passthrough: true }) response: any) {
    // Clear the JWT token cookie
    response.clearCookie('kora_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    return { success: true };
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async getMe(@Req() req: any) {
    return {
      user: req.user,
    };
  }

  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    const userId = req.user.sub;
    await this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
    return { success: true };
  }
}
