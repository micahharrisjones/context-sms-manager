import request from 'supertest';
import type { Express } from 'express';
import type { User } from '@shared/schema';

export interface TestUser {
  phoneNumber: string;
  displayName: string;
  id?: number;
}

export const testUsers = {
  alice: {
    phoneNumber: '+1234567890',
    displayName: 'Alice Test',
  },
  bob: {
    phoneNumber: '+1234567891',
    displayName: 'Bob Test',
  },
  charlie: {
    phoneNumber: '+1234567892',
    displayName: 'Charlie Test',
  },
};

export async function loginUser(app: Express, phoneNumber: string): Promise<string> {
  const agent = request.agent(app);
  
  const sendCodeResponse = await agent
    .post('/api/auth/send-code')
    .send({ phoneNumber });
  
  if (sendCodeResponse.status !== 200) {
    throw new Error(`Failed to send code: ${sendCodeResponse.body.message}`);
  }

  const loginResponse = await agent
    .post('/api/auth/login')
    .send({ phoneNumber, code: '123456' });

  if (loginResponse.status !== 200) {
    throw new Error(`Failed to login: ${loginResponse.body.message}`);
  }

  const cookies = loginResponse.headers['set-cookie'];
  if (!cookies || cookies.length === 0) {
    throw new Error('No session cookie received');
  }

  const sessionCookie = cookies.find((c: string) => c.startsWith('connect.sid='));
  if (!sessionCookie) {
    throw new Error('Session cookie not found');
  }

  return sessionCookie.split(';')[0];
}

export function createAuthenticatedAgent(app: Express, sessionCookie: string) {
  return request.agent(app).set('Cookie', sessionCookie);
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function generateRandomPhone(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const subscriber = Math.floor(Math.random() * 9000) + 1000;
  return `+1${areaCode}${exchange}${subscriber}`;
}

export function generateRandomEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}
