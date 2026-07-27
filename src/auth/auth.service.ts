import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { sanitizeDeep, validateSafeString } from '../common/security/security.util';

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }

  async register(registerDto: RegisterDto) {
    const safeDto = sanitizeDeep(registerDto);
    const { email, phone, password, firstName, lastName, role } = safeDto;
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
        role,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user,
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const safeDto = sanitizeDeep(loginDto);
    const { email, password } = safeDto;
    const prisma = this.prismaService.prisma;
    const safeEmail = validateSafeString(email, 'email', 255);

    const user = await prisma.user.findUnique({ where: { email: safeEmail } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
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

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
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
