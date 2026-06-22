import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const useFastify = process.env.BULLPEN_PLATFORM === 'fastify';
  let app: any;

  if (useFastify) {
    const { FastifyAdapter } = await import('@nestjs/platform-fastify');
    app = await NestFactory.create(AppModule, new FastifyAdapter());
  } else {
    app = await NestFactory.create(AppModule);
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  const platform = useFastify ? 'fastify' : 'express';
  console.log(`Bullpen demo (${platform}) → http://localhost:${port}/admin/queues  (admin / admin)`);
}

void bootstrap();
