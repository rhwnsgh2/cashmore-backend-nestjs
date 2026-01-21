import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './src/app.module';

async function main() {
  console.log('Starting app...');

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  console.log('App initialized');

  // Try to access routes
  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance();

  console.log('\nRegistered routes:');
  if (instance._router) {
    instance._router.stack.forEach((layer: any) => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
        console.log(`  ${methods} ${layer.route.path}`);
      }
    });
  }

  await app.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
