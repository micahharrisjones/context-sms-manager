import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from './test-app';
import { generateRandomPhone } from './helpers';

describe('Boards API', () => {
  let app: Express;
  let sessionCookie: string;
  let userId: number;

  beforeAll(async () => {
    app = await createTestApp();
    
    const phoneNumber = generateRandomPhone();
    const agent = request.agent(app);
    
    await agent
      .post('/api/auth/login')
      .send({ phoneNumber });

    const verifyResponse = await agent
      .post('/api/auth/verify')
      .send({ phoneNumber, code: '123456' });

    userId = verifyResponse.body.user.id;
    const cookies = verifyResponse.headers['set-cookie'];
    sessionCookie = cookies.find((c: string) => c.startsWith('connect.sid=')).split(';')[0];
  });

  describe('GET /api/boards', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/boards');

      expect(response.status).toBe(401);
    });

    it('should return boards for authenticated user', async () => {
      const response = await request(app)
        .get('/api/boards')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/boards', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/boards')
        .send({ name: 'Test Board', tag: 'test' });

      expect(response.status).toBe(401);
    });

    it('should require board name', async () => {
      const response = await request(app)
        .post('/api/boards')
        .set('Cookie', sessionCookie)
        .send({ tag: 'test' });

      expect(response.status).toBe(400);
    });

    it('should require board tag', async () => {
      const response = await request(app)
        .post('/api/boards')
        .set('Cookie', sessionCookie)
        .send({ name: 'Test Board' });

      expect(response.status).toBe(400);
    });

    it('should create a new board with valid data', async () => {
      const response = await request(app)
        .post('/api/boards')
        .set('Cookie', sessionCookie)
        .send({ 
          name: 'My Test Board',
          tag: 'testboard',
          isShared: false
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        name: 'My Test Board',
        tag: 'testboard',
        isShared: false,
        ownerId: userId
      });
    });
  });

  describe('GET /api/boards/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/boards/1');

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent board', async () => {
      const response = await request(app)
        .get('/api/boards/999999')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/boards/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/boards/1');

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent board', async () => {
      const response = await request(app)
        .delete('/api/boards/999999')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/boards/:id/join', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/boards/1/join');

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent board', async () => {
      const response = await request(app)
        .post('/api/boards/999999/join')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/boards/:id/leave', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/boards/1/leave');

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent board', async () => {
      const response = await request(app)
        .post('/api/boards/999999/leave')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });
  });
});
