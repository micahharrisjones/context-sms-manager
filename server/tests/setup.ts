import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { db } from '../db';

beforeAll(async () => {
  console.log('🧪 Test suite starting...');
});

afterAll(async () => {
  console.log('✅ Test suite completed');
});

beforeEach(async () => {
});

afterEach(async () => {
});
