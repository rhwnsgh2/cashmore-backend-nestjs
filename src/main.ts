import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 8000;

  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  await app.listen(port);
  console.log(`Server is running on http://localhost:${port}`);
}
bootstrap();
