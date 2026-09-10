import { Controller, Post, Body, UseGuards, Req, Param, Get, Patch, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterPharmacyDto } from './dto/register-pharmacy.dto';
import { RegisterInsuranceDto } from './dto/register-insurance.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserRole } from '@generated/prisma';
import { Public } from '../common/guards/public.decorator';
import { Roles } from '../common/guards/roles.decorator';
import { Permissions } from '../common/guards/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { clearAuthCookies, readCookie, REFRESH_TOKEN_COOKIE, setAuthCookies } from '../common/auth-cookies';
import { Throttle } from '@nestjs/throttler';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetOtpDto } from './dto/password-reset-otp.dto';
import { PasswordResetDto } from './dto/password-reset.dto';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Public()
  @Post('register')
  @Throttle({ registration: {} })
  @ApiOperation({ summary: 'Register a new patient account' })
  @ApiBody({ type: RegisterDto })
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.register(registerDto);
    if ('accessToken' in result && 'refreshToken' in result) {
      const authenticatedResult = result as { accessToken: string; refreshToken: string; [key: string]: unknown };
      setAuthCookies(response, authenticatedResult.accessToken, authenticatedResult.refreshToken);
      const { accessToken: _accessToken, refreshToken: _refreshToken, ...safeResult } = authenticatedResult;
      return safeResult;
    }
    return result;
  }

  @Public()
  @Post('register-pharmacy')
  @Throttle({ registration: {} })
  @ApiOperation({ summary: 'Submit a new pharmacy registration request' })
  @ApiBody({ type: RegisterPharmacyDto })
  async registerPharmacy(@Body() registerPharmacyDto: RegisterPharmacyDto) {
    return this.authService.registerPharmacy(registerPharmacyDto);
  }

  @Public()
  @Post('register-insurance')
  @Throttle({ registration: {} })
  @ApiOperation({ summary: 'Register a new insurance provider account' })
  @ApiBody({ type: RegisterInsuranceDto })
  async registerInsurance(@Body() registerInsuranceDto: RegisterInsuranceDto) {
    return this.authService.registerInsurance(registerInsuranceDto);
  }

  @Public()
  @Post('login')
  @Throttle({ login: {} })
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({
    type: LoginDto,
    examples: {
      default: {
        value: {
          email: 'user@example.com',
          password: 'password123',
        },
      },
    },
  })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(loginDto);
    setAuthCookies(response, result.accessToken, result.refreshToken);
    const { accessToken: _accessToken, refreshToken: _refreshToken, ...safeResult } = result;
    return safeResult;
  }

  @Public()
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) { return this.authService.verifyEmail(token); }

  @Public()
  @Post('resend-verification')
  @Throttle({ password: {} })
  async resendVerification(@Body('email') email: string) { return this.authService.resendVerificationEmail(email); }

  @Public()
  @Post('password-reset/request')
  @Throttle({ password: {} })
  @ApiOperation({ summary: 'Request a password reset code' })
  @ApiBody({ type: PasswordResetRequestDto })
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Public()
  @Post('password-reset/verify')
  @Throttle({ password: {} })
  @ApiOperation({ summary: 'Verify a password reset code' })
  @ApiBody({ type: PasswordResetOtpDto })
  async verifyPasswordReset(@Body() dto: PasswordResetOtpDto) {
    return this.authService.verifyPasswordReset(dto);
  }

  @Public()
  @Post('password-reset/complete')
  @Throttle({ password: {} })
  @ApiOperation({ summary: 'Complete a password reset' })
  @ApiBody({ type: PasswordResetDto })
  async completePasswordReset(@Body() dto: PasswordResetDto) {
    return this.authService.completePasswordReset(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('MANAGE_STAFF')
  @Roles(UserRole.PHARMACY)
  @Post('pharmacies/:pharmacyId/staff')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a pharmacy staff account' })
  async createStaff(@Param('pharmacyId') pharmacyId: string, @Req() req: any, @Body() createStaffDto: CreateStaffDto) {
    return this.authService.createStaff(pharmacyId, req.user.id, createStaffDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @Throttle({ password: {} })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the current user password' })
  async changePassword(@Req() req: any, @Body() changePasswordDto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, changePasswordDto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshTokens(@Req() request: any, @Res({ passthrough: true }) response: Response) {
    const refreshToken = readCookie(request, REFRESH_TOKEN_COOKIE);
    if (!refreshToken) return this.authService.refreshTokens({ refreshToken: '' });
    const result = await this.authService.refreshTokens({ refreshToken });
    setAuthCookies(response, result.accessToken, result.refreshToken);
    const { accessToken: _accessToken, refreshToken: _refreshToken, ...safeResult } = result;
    return safeResult;
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post('managed-users/insurance')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an insurance company user' })
  async createInsuranceUser(@Body() createManagedUserDto: CreateManagedUserDto) {
    return this.authService.createManagedUser(UserRole.INSURANCE, createManagedUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post('managed-users/government')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a government user' })
  async createGovernmentUser(@Body() createManagedUserDto: CreateManagedUserDto) {
    return this.authService.createManagedUser(UserRole.GOVERNMENT, createManagedUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post('managed-users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a managed user (admin only)' })
  async createManagedUser(@Body() createManagedUserDto: CreateManagedUserDto) {
    return this.authService.createManagedUser(createManagedUserDto.role, createManagedUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN, UserRole.GOVERNMENT)
  @Get('pharmacies/pending')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List pending pharmacy registrations' })
  async listPendingPharmacies() {
    return this.authService.listPendingPharmacies();
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN, UserRole.GOVERNMENT)
  @Patch('pharmacies/:pharmacyId/approve')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve or reject a pharmacy registration' })
  async approvePharmacy(@Param('pharmacyId') pharmacyId: string, @Body('approved') approved: boolean) {
    return this.authService.approvePharmacy(pharmacyId, approved);
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Logout user' })
  async logout(@Req() request: any, @Res({ passthrough: true }) response: Response) {
    const refreshToken = readCookie(request, REFRESH_TOKEN_COOKIE);
    const result = await this.authService.logout(refreshToken);
    clearAuthCookies(response);
    return result;
  }
}
