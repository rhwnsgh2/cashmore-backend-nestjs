import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentAdvertiserData {
  advertiserId: number;
  companyName: string;
}

export const CurrentAdvertiser = createParamDecorator(
  (
    data: keyof CurrentAdvertiserData | undefined,
    ctx: ExecutionContext,
  ) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentAdvertiserData;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);
