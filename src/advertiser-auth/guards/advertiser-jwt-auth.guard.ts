import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

interface AdvertiserJwtPayload {
  advertiserId: number;
  companyName: string;
  iat: number;
  exp: number;
}

@Injectable()
export class AdvertiserJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(AdvertiserJwtAuthGuard.name);

  constructor(private configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const secret = this.configService.get<string>('advertiser.jwtSecret');

      if (!secret) {
        throw new UnauthorizedException('Advertiser JWT secret not configured');
      }

      const payload = jwt.verify(token, secret) as AdvertiserJwtPayload;

      request.user = {
        advertiserId: payload.advertiserId,
        companyName: payload.companyName,
      };

      return true;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        this.logger.warn(`Invalid advertiser token: ${error.message}`);
        throw new UnauthorizedException('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token expired');
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
