import { Injectable, UnauthorizedException, ConflictException, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterPharmacyDto } from './dto/register-pharmacy.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { sanitizeDeep, validateSafeString } from '../common/security/security.util';
import { AUTH_PERMISSIONS, STAFF_ROLE_PERMISSIONS } from './auth.constants';
import { UserRole } from '@generated/prisma';

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }

  async register(registerDto: RegisterDto) {
    const safeDto = sanitizeDeep(registerDto);
    const { email, phone, password, firstName, lastName } = safeDto;
    const prisma = this.prismaService.prisma;
    const safeEmail = validateSafeString(email, 'email', 255);
    const safePhone = validateSafeString(phone, 'phone', 30);

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email: safeEmail }, { phone: safePhone }] },
    });

    if (existingUser) {
      throw new ConflictException('User with this email or phone already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: safeEmail,
        phone: safePhone,
        password: hashedPassword,
        firstName,
        lastName,
        role: UserRole.PATIENT,
        permissions: AUTH_PERMISSIONS.patient,
        firstLogin: false,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        position: true,
        permissions: true,
        pharmacyId: true,
        organizationId: true,
        firstLogin: true,
        isActive: true,
        createdAt: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role, user.permissions, user.pharmacyId, user.organizationId, user.position, user.firstLogin);

    return {
      user,
      ...tokens,
    };
  }

  async registerPharmacy(registerPharmacyDto: RegisterPharmacyDto) {
    const safeDto = sanitizeDeep(registerPharmacyDto);
    const prisma = this.prismaService.prisma;
    const safeEmail = validateSafeString(safeDto.email, 'email', 255);
    const safePhone = validateSafeString(safeDto.phone, 'phone', 30);

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email: safeEmail }, { phone: safePhone }] },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email or phone already exists');
    }

    const hashedPassword = await bcrypt.hash(safeDto.password, 10);

    const owner = await prisma.user.create({
      data: {
        email: safeEmail,
        phone: safePhone,
        password: hashedPassword,
        firstName: safeDto.managerName.split(' ')[0] || safeDto.managerName,
        lastName: safeDto.managerName.split(' ').slice(1).join(' ') || 'Manager',
        role: UserRole.PHARMACY,
        position: 'Manager',
        permissions: AUTH_PERMISSIONS.manager,
        firstLogin: true,
        isActive: true,
      },
    });

    const pharmacy = await prisma.pharmacy.create({
      data: {
        ownerId: owner.id,
        name: safeDto.pharmacyName,
        address: safeDto.address,
        phone: safePhone,
        licenseNumber: safeDto.licenseNumber,
        district: safeDto.district,
        province: safeDto.province,
        managerName: safeDto.managerName,
        licenseUrl: safeDto.licenseUrl,
        status: 'PENDING' as any,
        isActive: false,
      },
    });

    await prisma.user.update({
      where: { id: owner.id },
      data: { pharmacyId: pharmacy.id, organizationId: pharmacy.id },
    });

    return {
      message: 'Pharmacy registration received and is pending approval',
      pharmacy,
      user: {
        id: owner.id,
        email: owner.email,
        role: owner.role,
        firstLogin: true,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const safeDto = sanitizeDeep(loginDto);
    const { email, password } = safeDto;
    const prisma = this.prismaService.prisma;
    const safeEmail = validateSafeString(email, 'email', 255);

    const user = await prisma.user.findUnique({
      where: { email: safeEmail },
      include: { pharmacy: true }
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account is not active yet');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role, user.permissions, user.pharmacyId, user.organizationId, user.position, user.firstLogin);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        position: user.position,
        permissions: user.permissions,
        pharmacyId: user.pharmacyId,
        organizationId: user.organizationId,
        firstLogin: user.firstLogin,
        pharmacy: user.pharmacy,
      },
      ...tokens,
    };
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = sanitizeDeep(refreshTokenDto);
    const prisma = this.prismaService.prisma;

    const storedToken = await prisma.refreshToken.findFirst({
      where: { token: refreshToken, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const tokens = await this.generateTokens(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.role,
      storedToken.user.permissions,
      storedToken.user.pharmacyId,
      storedToken.user.organizationId,
      storedToken.user.position,
      storedToken.user.firstLogin,
    );

    return {
      user: {
        id: storedToken.user.id,
        email: storedToken.user.email,
        phone: storedToken.user.phone,
        firstName: storedToken.user.firstName,
        lastName: storedToken.user.lastName,
        role: storedToken.user.role,
      },
      ...tokens,
    };
  }

  async logout(refreshToken: string) {
    const prisma = this.prismaService.prisma;
    const safeToken = validateSafeString(refreshToken, 'refreshToken', 500);
    await prisma.refreshToken.deleteMany({ where: { token: safeToken } });
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const prisma = this.prismaService.prisma;
    const safeDto = sanitizeDeep(changePasswordDto);
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new NotFoundException('User not found');
    if (!(await bcrypt.compare(safeDto.currentPassword, user.password))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(safeDto.newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, firstLogin: false },
    });

    return { message: 'Password updated successfully' };
  }

  async createStaff(pharmacyId: string, managerId: string, createStaffDto: CreateStaffDto) {
    const prisma = this.prismaService.prisma;
    const safeDto = sanitizeDeep(createStaffDto);
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
    const manager = await prisma.user.findUnique({ where: { id: managerId } });

    if (!pharmacy) throw new NotFoundException('Pharmacy not found');
    if (!manager || manager.pharmacyId !== pharmacy.id || !manager.permissions.includes('MANAGE_STAFF')) {
      throw new ForbiddenException('Only active pharmacy managers can create staff accounts');
    }

    const tempPassword = randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const staff = await prisma.user.create({
      data: {
        email: safeDto.email,
        phone: safeDto.phone,
        password: hashedPassword,
        firstName: safeDto.firstName,
        lastName: safeDto.lastName,
        role: safeDto.role,
        position: safeDto.position,
        permissions: STAFF_ROLE_PERMISSIONS[safeDto.position.toUpperCase()] || [],
        pharmacyId: pharmacy.id,
        organizationId: pharmacy.id,
        firstLogin: true,
        isActive: true,
      },
    });

    return {
      message: 'Staff account created successfully',
      tempPassword,
      user: {
        id: staff.id,
        email: staff.email,
        role: staff.role,
        position: staff.position,
        permissions: staff.permissions,
        pharmacyId: staff.pharmacyId,
      },
    };
  }

  async createManagedUser(userRole: UserRole, createManagedUserDto: CreateManagedUserDto) {
    const prisma = this.prismaService.prisma;
    const safeDto = sanitizeDeep(createManagedUserDto);
    const safeEmail = validateSafeString(safeDto.email, 'email', 255);
    const safePhone = validateSafeString(safeDto.phone, 'phone', 30);

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email: safeEmail }, { phone: safePhone }] },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email or phone already exists');
    }

    const hashedPassword = await bcrypt.hash(safeDto.password, 10);
    const permissions = userRole === UserRole.INSURANCE
      ? AUTH_PERMISSIONS.insurance
      : userRole === UserRole.GOVERNMENT
        ? AUTH_PERMISSIONS.government
        : [];

    const user = await prisma.user.create({
      data: {
        email: safeEmail,
        phone: safePhone,
        password: hashedPassword,
        firstName: safeDto.firstName,
        lastName: safeDto.lastName,
        role: userRole,
        position: safeDto.position || undefined,
        permissions,
        firstLogin: true,
        isActive: true,
      },
    });

    return { message: 'Managed user created successfully', user: { id: user.id, email: user.email, role: user.role } };
  }

  async listPendingPharmacies() {
    const prisma = this.prismaService.prisma;
    return prisma.pharmacy.findMany({
      where: { status: 'PENDING' as any },
      include: { owner: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approvePharmacy(pharmacyId: string, approved: boolean) {
    const prisma = this.prismaService.prisma;
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    await prisma.pharmacy.update({
      where: { id: pharmacyId },
      data: { status: approved ? 'APPROVED' as any : 'REJECTED' as any, isActive: approved },
    });

    if (approved) {
      await prisma.user.updateMany({
        where: { pharmacyId },
        data: { isActive: true },
      });
    }

    return { message: approved ? 'Pharmacy approved successfully' : 'Pharmacy rejected successfully' };
  }

  private async generateTokens(userId: string, email: string, role: UserRole, permissions: string[], pharmacyId: string | null, organizationId: string | null, position: string | null, firstLogin: boolean) {
    const payload = { sub: userId, email, role, permissions, pharmacyId, organizationId, position, firstLogin };
    const prisma = this.prismaService.prisma;

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = randomBytes(64).toString('hex');
    const expiresIn = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') || '7';
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiresIn));

    await prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
