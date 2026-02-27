import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { BUZZVIL_POSTBACK_WHITELIST_IPS } from '../buzzvil.constants';

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  private readonly logger = new Logger(IpWhitelistGuard.name);
  private readonly allowedIps = new Set<string>(
    BUZZVIL_POSTBACK_WHITELIST_IPS,
  );

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const clientIp = request.ip;

    if (this.allowedIps.has(clientIp)) {
      return true;
    }

    this.logger.warn(`Blocked postback from IP: ${clientIp}`);
    throw new ForbiddenException('IP not allowed');
  }
}
