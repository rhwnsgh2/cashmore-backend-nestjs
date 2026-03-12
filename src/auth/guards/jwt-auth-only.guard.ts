import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

interface JwtPayload {
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  email?: string;
  role?: string;
}

/**
 * JWT 서명만 검증하는 가드.
 * DB에 사용자가 존재하지 않아도 통과 (회원가입 등에서 사용).
 * request.user = { authId, email } 설정.
 */
@Injectable()
export class JwtAuthOnlyGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthOnlyGuard.name);

  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn('No token provided in request');
      throw new UnauthorizedException('No token provided');
    }

    try {
      const jwtSecret = this.configService.get<string>('supabase.jwtSecret');

      if (!jwtSecret) {
        throw new UnauthorizedException('JWT secret not configured');
      }

      const payload = jwt.verify(token, jwtSecret, {
        ignoreExpiration: true,
      }) as JwtPayload;

      if (!payload.sub) {
        throw new UnauthorizedException('Invalid token: missing sub');
      }

      request.user = {
        authId: payload.sub,
        email: payload.email || '',
      };

      return true;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        this.logger.warn(`Invalid token: ${error.message}`);
        throw new UnauthorizedException('Invalid token');
      }
      throw error;
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authorization = request.headers['authorization'];

    if (!authorization) {
      return undefined;
    }

    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
