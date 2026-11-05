import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearApp } from './helpers/app.js';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await crearApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1 es público y responde 200', async () => {
    await request(app.getHttpServer()).get('/api/v1').expect(200);
  });

  it('sin el prefijo la ruta no existe', async () => {
    await request(app.getHttpServer()).get('/').expect(404);
  });
});
