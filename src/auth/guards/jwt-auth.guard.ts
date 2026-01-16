import {
  CanActivate,
  ExecutionContext,
  Injectable,
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
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const jwtSecret = this.configService.get<string>('supabase.jwtSecret');

      if (!jwtSecret) {
        throw new UnauthorizedException('JWT secret not configured');
      }

      const payload = jwt.verify(token, jwtSecret) as JwtPayload;

      const userId = await this.authService.getUserIdByAuthId(payload.sub);

      if (!userId) {
        throw new UnauthorizedException('User not found');
      }

      request.user = {
        userId,
        authId: payload.sub,
      };

      return true;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
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
