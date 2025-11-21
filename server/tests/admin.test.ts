import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from './test-app';
import { generateRandomPhone } from './helpers';

describe('Admin API', () => {
  let app: Express;
  let sessionCookie: string;

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

    const cookies = verifyResponse.headers['set-cookie'];
    sessionCookie = cookies.find((c: string) => c.startsWith('connect.sid=')).split(';')[0];
  });

  describe('GET /api/admin/stats', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/stats');

      expect(response.status).toBe(401);
    });

    it('should return admin statistics for authenticated user', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalUsers');
      expect(response.body).toHaveProperty('totalMessages');
      expect(response.body).toHaveProperty('totalSharedBoards');
      expect(response.body).toHaveProperty('recentSignups');
    });
  });

  describe('GET /api/admin/users', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/users');

      expect(response.status).toBe(401);
    });

    it('should return user list for authenticated user', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('phoneNumber');
        expect(response.body[0]).toHaveProperty('displayName');
      }
    });
  });

  describe('POST /api/admin/backfill-pendo-metadata', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/admin/backfill-pendo-metadata');

      expect(response.status).toBe(401);
    });

    it('should process backfill request for authenticated user', async () => {
      const response = await request(app)
        .post('/api/admin/backfill-pendo-metadata')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('updated');
      expect(response.body).toHaveProperty('failed');
      expect(response.body).toHaveProperty('skipped');
    });
  });

  describe('POST /api/admin/update-sms-activity', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/admin/update-sms-activity');

      expect(response.status).toBe(401);
    });

    it('should update SMS activity for all users', async () => {
      const response = await request(app)
        .post('/api/admin/update-sms-activity')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('updated');
    });
  });

  describe('POST /api/admin/enrich-old-posts', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/admin/enrich-old-posts');

      expect(response.status).toBe(401);
    });

    it('should process post enrichment for authenticated user', async () => {
      const response = await request(app)
        .post('/api/admin/enrich-old-posts')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('processed');
      expect(response.body).toHaveProperty('skipped');
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/admin/feedback', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/feedback');

      expect(response.status).toBe(401);
    });

    it('should return feedback submissions', async () => {
      const response = await request(app)
        .get('/api/admin/feedback')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/admin/sweepstakes', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/sweepstakes');

      expect(response.status).toBe(401);
    });

    it('should return sweepstakes entries', async () => {
      const response = await request(app)
        .get('/api/admin/sweepstakes')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
