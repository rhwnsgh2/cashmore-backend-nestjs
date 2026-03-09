import { Global, Module } from '@nestjs/common';
import { AmplitudeService } from './amplitude.service';

@Global()
@Module({
  providers: [AmplitudeService],
  exports: [AmplitudeService],
})
export class AmplitudeModule {}
