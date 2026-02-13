# Test Suite

Comprehensive test suite for the Personal CMS backend API.

## Test Framework

- **Vitest** - Fast unit test framework with TypeScript support
- **@cloudflare/vitest-pool-workers** - Test Cloudflare Workers in isolated environment
- **Miniflare** - Local Cloudflare Workers simulator with D1 and R2

## Test Structure

```
tests/
├── integration/        # Integration tests (API endpoints)
│   ├── auth.test.ts   # Authentication API tests
│   └── files.test.ts  # File management API tests
├── unit/              # Unit tests (business logic)
└── helpers/           # Test utilities and mocks
    └── test-utils.ts  # Helper functions for tests
```

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-run on changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Coverage

### Authentication API (`auth.test.ts`)

- ✅ User registration (success, duplicate email, short password, missing fields)
- ✅ User login (correct credentials, wrong password, non-existent email)
- ✅ Get current user (authenticated, not authenticated)
- ✅ Logout (clear session, clear cookie)

### Files API (`files.test.ts`)

- ✅ File upload (JSON, multipart, requires auth, duplicate paths)
- ✅ List files (user's files, anonymous returns empty)
- ✅ Get file (metadata + content, non-existent file)
- ✅ Update file (content, size change, requires auth)
- ✅ Delete file (success, non-existent file)

## Writing New Tests

### 1. Create Test File

For new features, create a test file in `tests/integration/`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { env, SELF } from "cloudflare:test";
import { createTestRequest, getResponseJson } from "../helpers/test-utils";

describe("New Feature API", () => {
  beforeAll(async () => {
    // Set up database schema
    await env.DB.exec(`CREATE TABLE ...`);
  });

  it("should do something", async () => {
    const request = createTestRequest("GET", "/api/endpoint");
    const response = await SELF.fetch(request);
    const data = await getResponseJson(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
```

### 2. Use Test Utilities

```typescript
// Create a test request
const request = createTestRequest("POST", "/api/endpoint", {
  body: { key: "value" },
  cookies: { token: "..." },
  headers: { "Custom-Header": "value" },
});

// Get JSON from response
const data = await getResponseJson(response);

// Extract cookies from response
const cookies = getCookiesFromResponse(response);

// Use test data
import { testUsers, testFiles } from "../helpers/test-utils";
```

### 3. Test Authenticated Endpoints

```typescript
// Login first
const loginRequest = createTestRequest("POST", "/api/auth/login", {
  body: {
    email: testUsers.user.email,
    password: testUsers.user.password,
  },
});

const loginResponse = await SELF.fetch(loginRequest);
const cookies = getCookiesFromResponse(loginResponse);

// Use cookie in subsequent requests
const request = createTestRequest("GET", "/api/protected", { cookies });
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Setup**: Use `beforeAll` to create database schema and test data
3. **Cleanup**: Tests automatically run in isolated Miniflare instances
4. **Assertions**: Use descriptive expect messages
5. **Coverage**: Test success cases, error cases, edge cases, and validation

## Continuous Integration

Tests run automatically on:
- Pre-commit (via git hooks)
- Pull requests (via GitHub Actions)
- Deployments (must pass before deploy)

## Debugging Tests

```bash
# Run specific test file
npx vitest run tests/integration/auth.test.ts

# Run tests matching pattern
npx vitest run -t "should register"

# Show console.log output
npx vitest run --reporter=verbose
```

## Coverage Goals

- **Unit Tests**: 80%+ coverage of business logic
- **Integration Tests**: 100% coverage of API endpoints
- **E2E Tests**: Critical user flows (login, upload, share)

## Future Improvements

- [ ] E2E tests with Playwright
- [ ] Performance benchmarks
- [ ] Load testing
- [ ] Security testing (OWASP top 10)
- [ ] Frontend component tests with React Testing Library
