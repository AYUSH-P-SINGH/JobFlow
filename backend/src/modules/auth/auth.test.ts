import test from 'node:test';
import assert from 'node:assert';
import supertest from 'supertest';
import app from '../../app.js';
import { userRepository } from './auth.repository.js';

test.describe('Auth Module Integration Tests', () => {
  const request = supertest(app);

  test.beforeEach(async () => {
    await userRepository.clear();
  });

  test('POST /api/v1/auth/register - success', async () => {
    const res = await request
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.accessToken);
    assert.ok(res.body.data.refreshToken);
    assert.strictEqual(res.body.data.user.email, 'test@example.com');
  });

  test('POST /api/v1/auth/register - duplicate email', async () => {
    await request
      .post('/api/v1/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' });

    const res = await request
      .post('/api/v1/auth/register')
      .send({ email: 'dup@example.com', password: 'password456' });

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /already registered/);
  });

  test('POST /api/v1/auth/register - validation failure (short password)', async () => {
    const res = await request
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: '123' });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.errors);
  });

  test('POST /api/v1/auth/login - success', async () => {
    await request
      .post('/api/v1/auth/register')
      .send({ email: 'login@example.com', password: 'password123' });

    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.com', password: 'password123' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.accessToken);
    assert.strictEqual(res.body.data.user.email, 'login@example.com');
  });

  test('POST /api/v1/auth/login - wrong password', async () => {
    await request
      .post('/api/v1/auth/register')
      .send({ email: 'wrongpass@example.com', password: 'password123' });

    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: 'wrongpass@example.com', password: 'wrongpassword' });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Invalid credentials/);
  });

  test('GET /api/v1/auth/me - success', async () => {
    const regRes = await request
      .post('/api/v1/auth/register')
      .send({ email: 'me@example.com', password: 'password123' });

    const token = regRes.body.data.accessToken;

    const res = await request
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.user.email, 'me@example.com');
  });

  test('GET /api/v1/auth/me - missing token', async () => {
    const res = await request
      .get('/api/v1/auth/me');

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /missing or invalid/);
  });

  test('GET /api/v1/auth/me - invalid token', async () => {
    const res = await request
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalidtokenhere');

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /invalid or expired/);
  });

  test('POST /api/v1/auth/refresh - success', async () => {
    const regRes = await request
      .post('/api/v1/auth/register')
      .send({ email: 'refresh@example.com', password: 'password123' });

    const refreshToken = regRes.body.data.refreshToken;

    const res = await request
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.accessToken);
    assert.ok(res.body.data.refreshToken);
  });
});
