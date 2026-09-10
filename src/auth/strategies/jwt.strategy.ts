import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ACCESS_TOKEN_COOKIE, readCookie } from '../../common/auth-cookies';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: (request: Request) =>
        readCookie(request, ACCESS_TOKEN_COOKIE) ||
        ExtractJwt.fromAuthHeaderAsBearerToken()(request),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role === 'PHARMACY' ? 'PHARMACY_OWNER' : payload.role,
      permissions: payload.permissions || [],
      pharmacyId: payload.pharmacyId || null,
      position: payload.position || null,
      firstLogin: payload.firstLogin || false,
    };
  }
}
