import { Module } from '@nestjs/common';
import { LocalPromotionController } from './local-promotion.controller';

@Module({
  controllers: [LocalPromotionController],
})
export class LocalPromotionModule {}
