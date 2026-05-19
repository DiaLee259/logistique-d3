import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', 'default-secret-change-me'),
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        role: true,
        privileges: true,
        actif: true,
        managerZoneId: true,
        managerZone: {
          select: { id: true, nom: true, departements: true },
        },
      },
    });

    // Déconnexion immédiate si le compte a été désactivé
    if (!user || user.actif === false) {
      throw new UnauthorizedException('Compte désactivé');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: user.role,
      privileges: (user.privileges ?? null) as any,
      managerZone: user.managerZone ?? null,
    };
  }
}
