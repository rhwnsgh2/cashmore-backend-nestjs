import { Module } from '@nestjs/common';
import { AdminNaverPayController } from './admin-naver-pay.controller';
import { NaverPayModule } from '../naver-pay/naver-pay.module';

@Module({
  imports: [NaverPayModule],
  controllers: [AdminNaverPayController],
})
export class AdminModule {}
