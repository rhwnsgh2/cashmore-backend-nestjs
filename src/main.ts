import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 8000;

  // ALB 뒤에서 실제 클라이언트 IP 인식 (X-Forwarded-For 헤더 사용)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  app.use(helmet());
  app.use(compression());
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // 요청 로깅: development는 전체, production은 에러(4xx, 5xx)만
  if (configService.get<string>('nodeEnv') === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(
      morgan('combined', {
        skip: (_req, res) => res.statusCode < 400,
      }),
    );
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
