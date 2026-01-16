import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import morgan from 'morgan';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 8000;

  app.use(helmet());
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Development에서만 요청 로그 출력
  if (configService.get<string>('nodeEnv') === 'development') {
    app.use(morgan('dev'));
  }

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('Cashmore API')
    .setDescription('Cashmore Backend API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(port);
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
}
void bootstrap();
