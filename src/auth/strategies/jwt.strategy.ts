import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  async validate(payload: any) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role === 'PHARMACY' ? 'PHARMACY_OWNER' : payload.role,
      permissions: payload.permissions || [],
      pharmacyId: payload.pharmacyId || null,
      organizationId: payload.organizationId || null,
      position: payload.position || null,
      firstLogin: payload.firstLogin || false,
    };
  }
}
