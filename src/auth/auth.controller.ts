import { Controller, Post, Body, UseGuards, Req, Param, Get, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterPharmacyDto } from './dto/register-pharmacy.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserRole } from '@generated/prisma';
import { Public } from '../common/guards/public.decorator';
import { Roles } from '../common/guards/roles.decorator';
import { Permissions } from '../common/guards/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new patient account' })
  @ApiBody({ type: RegisterDto })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('register-pharmacy')
  @ApiOperation({ summary: 'Submit a new pharmacy registration request' })
  @ApiBody({ type: RegisterPharmacyDto })
  async registerPharmacy(@Body() registerPharmacyDto: RegisterPharmacyDto) {
    return this.authService.registerPharmacy(registerPharmacyDto);
  }

  @Public()
  @Post('login')
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
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) { return this.authService.verifyEmail(token); }

  @Public()
  @Post('resend-verification')
  async resendVerification(@Body('email') email: string) { return this.authService.resendVerificationEmail(email); }

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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the current user password' })
  async changePassword(@Req() req: any, @Body() changePasswordDto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, changePasswordDto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({
    type: RefreshTokenDto,
    examples: {
      default: {
        value: {
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto);
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

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiBody({
    type: RefreshTokenDto,
    examples: {
      default: {
        value: {
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  async logout(@Body('refreshToken') refreshToken: string) {
    return this.authService.logout(refreshToken);
  }
}
