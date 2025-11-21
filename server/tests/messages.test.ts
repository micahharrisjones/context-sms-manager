import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from './test-app';
import { generateRandomPhone } from './helpers';

describe('Messages API', () => {
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

  describe('GET /api/messages', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/messages');

      expect(response.status).toBe(401);
    });

    it('should return messages for authenticated user', async () => {
      const response = await request(app)
        .get('/api/messages')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter messages by tag', async () => {
      const response = await request(app)
        .get('/api/messages?tag=work')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter messages by board', async () => {
      const response = await request(app)
        .get('/api/messages?board=1')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/messages/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/messages/1');

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent message', async () => {
      const response = await request(app)
        .get('/api/messages/999999')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/messages/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .patch('/api/messages/1')
        .send({ content: 'Updated content' });

      expect(response.status).toBe(401);
    });

    it('should reject empty update', async () => {
      const response = await request(app)
        .patch('/api/messages/1')
        .set('Cookie', sessionCookie)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/messages/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/messages/1');

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent message', async () => {
      const response = await request(app)
        .delete('/api/messages/999999')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/tags', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/tags');

      expect(response.status).toBe(401);
    });

    it('should return user tags for authenticated user', async () => {
      const response = await request(app)
        .get('/api/tags')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
