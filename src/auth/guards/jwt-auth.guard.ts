import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { AuthService } from '../auth.service';

interface JwtPayload {
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  email?: string;
  role?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

      // 만료된 토큰도 서명 검증 후 허용 (프론트 race condition 대응)
      // TODO: 프론트에서 토큰 갱신 로직 개선 후 ignoreExpiration 제거 필요
      const payload = jwt.verify(token, jwtSecret, {
        ignoreExpiration: true,
      }) as JwtPayload;

      // 만료된 토큰 사용 시 경고 로그 (추후 프론트 수정을 위한 모니터링)
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        const expiredAgo = Math.floor((now - payload.exp) / 60);
        this.logger.warn(
          `[EXPIRED_TOKEN] authId=${payload.sub}, expiredAgo=${expiredAgo}min`,
        );
      }

      const userId = await this.authService.getUserIdByAuthId(payload.sub);

      if (!userId) {
        this.logger.warn(`User not found for authId: ${payload.sub}`);
        throw new UnauthorizedException('User not found');
      }

      request.user = {
        userId,
        authId: payload.sub,
      };

      return true;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        this.logger.warn(`Invalid token: ${error.message}`);
        throw new UnauthorizedException('Invalid token');
      }
      this.logger.error(`Unexpected auth error: ${error}`);
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
