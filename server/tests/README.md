# Backend API Testing

This directory contains automated tests for all backend API endpoints using Vitest and Supertest.

## Test Structure

- `auth.test.ts` - Authentication and session management tests
- `messages.test.ts` - Message CRUD operations and filtering tests
- `boards.test.ts` - Shared board functionality tests
- `admin.test.ts` - Admin dashboard and management endpoint tests
- `helpers.ts` - Shared test utilities and helper functions
- `test-app.ts` - Test Express app configuration
- `setup.ts` - Global test setup and teardown

## Running Tests

### Run all tests once
```bash
npx vitest run
```

### Run tests in watch mode (auto-rerun on file changes)
```bash
npx vitest watch
```

### Run tests with UI dashboard
```bash
npx vitest --ui
```

### Run tests with coverage report
```bash
npx vitest run --coverage
```

### Run specific test file
```bash
npx vitest run server/tests/auth.test.ts
```

### Run tests matching a pattern
```bash
npx vitest run -t "authentication"
```

## Test Coverage

The test suite covers:

### Authentication API (`/api/auth/*`)
- ✅ User registration and verification flow
- ✅ Session management
- ✅ Login/logout functionality
- ✅ Phone number validation
- ✅ Error handling for invalid inputs

### Messages API (`/api/messages/*`)
- ✅ Fetching user messages
- ✅ Filtering by tags and boards
- ✅ Message updates and deletion
- ✅ Tag retrieval
- ✅ Authentication requirements

### Boards API (`/api/boards/*`)
- ✅ Board creation and management
- ✅ Joining and leaving shared boards
- ✅ Board ownership validation
- ✅ Input validation
- ✅ Authorization checks

### Admin API (`/api/admin/*`)
- ✅ User statistics
- ✅ User management
- ✅ Pendo analytics backfill
- ✅ SMS activity updates
- ✅ Post enrichment
- ✅ Feedback and sweepstakes management

## Writing New Tests

### Basic Test Structure
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Feature Name', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('should do something', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .send({ data: 'value' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ expected: 'result' });
  });
});
```

### Authentication Helper
```typescript
import { generateRandomPhone } from './helpers';

// Create authenticated session
const phoneNumber = generateRandomPhone();
const agent = request.agent(app);

await agent.post('/api/auth/login').send({ phoneNumber });
await agent.post('/api/auth/verify').send({ phoneNumber, code: '123456' });

// Now agent has authenticated session
const response = await agent.get('/api/protected-endpoint');
```

## Best Practices

1. **Use random data generators** - Avoid hardcoded test data that might conflict
2. **Test error cases** - Always test both success and failure scenarios
3. **Test authentication** - Verify protected endpoints reject unauthenticated requests
4. **Clean assertions** - Use specific matchers like `toMatchObject` instead of loose checks
5. **Descriptive test names** - Clearly describe what behavior is being tested

## CI/CD Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npx vitest run --coverage
```

## Debugging Tests

### Run single test in watch mode
```bash
npx vitest watch server/tests/auth.test.ts
```

### Use the UI for interactive debugging
```bash
npx vitest --ui
```

### Add debugging output
```typescript
it('should work', async () => {
  const response = await request(app).get('/api/test');
  console.log('Response:', response.body);
  expect(response.status).toBe(200);
});
```
