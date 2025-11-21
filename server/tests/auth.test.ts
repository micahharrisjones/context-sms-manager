import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from './test-app';
import { testUsers, generateRandomPhone } from './helpers';

describe('Authentication API', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('POST /api/auth/login', () => {
    it('should initiate verification for a new user', async () => {
      const phoneNumber = generateRandomPhone();
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({ phoneNumber });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        requiresVerification: true,
      });
      expect(response.body.phoneNumber).toBeTruthy();
    });

    it('should reject request without phone number', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should handle formatted phone numbers', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ phoneNumber: '(123) 456-7890' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/auth/verify', () => {
    it('should reject verification without phone number', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .send({ code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject verification without code', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .send({ phoneNumber: '+1234567890' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject invalid verification code', async () => {
      const phoneNumber = generateRandomPhone();
      
      await request(app)
        .post('/api/auth/login')
        .send({ phoneNumber });

      const response = await request(app)
        .post('/api/auth/verify')
        .send({ 
          phoneNumber, 
          code: '000000'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should successfully verify and create session with valid code', async () => {
      const phoneNumber = generateRandomPhone();
      
      await request(app)
        .post('/api/auth/login')
        .send({ phoneNumber });

      const response = await request(app)
        .post('/api/auth/verify')
        .send({ 
          phoneNumber, 
          code: '123456'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.phoneNumber).toBeTruthy();
      
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.startsWith('connect.sid='))).toBe(true);
    });
  });

  describe('GET /api/auth/session', () => {
    it('should return unauthenticated for no session', async () => {
      const response = await request(app)
        .get('/api/auth/session');

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(false);
    });

    it('should return authenticated with valid session', async () => {
      const agent = request.agent(app);
      const phoneNumber = generateRandomPhone();
      
      await agent
        .post('/api/auth/login')
        .send({ phoneNumber });

      await agent
        .post('/api/auth/verify')
        .send({ phoneNumber, code: '123456' });

      const response = await agent
        .get('/api/auth/session');

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(true);
      expect(response.body.userId).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout and destroy session', async () => {
      const agent = request.agent(app);
      const phoneNumber = generateRandomPhone();
      
      await agent
        .post('/api/auth/login')
        .send({ phoneNumber });

      await agent
        .post('/api/auth/verify')
        .send({ phoneNumber, code: '123456' });

      const logoutResponse = await agent
        .post('/api/auth/logout');

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.message).toContain('success');

      const sessionResponse = await agent
        .get('/api/auth/session');

      expect(sessionResponse.body.authenticated).toBe(false);
    });
  });
});
