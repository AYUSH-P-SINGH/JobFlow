import test, { mock } from 'node:test';
import assert from 'node:assert';
import supertest from 'supertest';
import app from '../../app.js';
import prisma from '../../prisma.js';
import { EnqueueService } from './enqueue.service.js';

test.describe('Job Module Integration Tests', { concurrency: 1 }, () => {
  const request = supertest(app);

  // Mock EnqueueService to bypass Redis and immediately succeed during integration tests
  mock.method(EnqueueService, 'enqueueJob', async (job: any) => {
    return { id: job.id } as any;
  });

  let tokenA: string;
  let userAId: string;

  let tokenB: string;
  let userBId: string;

  let adminToken: string;
  let adminId: string;

  test.beforeEach(async () => {
    // Clear database users and jobs
    await prisma.refreshToken.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.user.deleteMany({});

    // Register User A
    const resA = await request
      .post('/api/v1/auth/register')
      .send({ email: 'usera@example.com', password: 'password123' });
    tokenA = resA.body.data.accessToken;
    userAId = resA.body.data.user.id;

    // Register User B
    const resB = await request
      .post('/api/v1/auth/register')
      .send({ email: 'userb@example.com', password: 'password123' });
    tokenB = resB.body.data.accessToken;
    userBId = resB.body.data.user.id;

    // Register Admin and update role in DB
    const resAdminReg = await request
      .post('/api/v1/auth/register')
      .send({ email: 'admin@example.com', password: 'password123' });
    adminId = resAdminReg.body.data.user.id;

    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'ADMIN' },
    });

    // Login Admin to get token
    const resAdminLogin = await request
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'password123' });
    adminToken = resAdminLogin.body.data.accessToken;
  });

  test.after(async () => {
    await prisma.$disconnect();
    try {
      const { redisConnection } = await import('../../config/redis.js');
      await redisConnection.quit();
    } catch {}
  });

  // 1. Create Job tests
  test('POST /api/v1/jobs - success', async () => {
    const res = await request
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Send Test Email',
        description: 'Send test email via SMTP',
        type: 'EMAIL',
        priority: 'HIGH',
        payload: { to: 'hello@example.com', subject: 'Integration Test' },
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.id);
    assert.strictEqual(res.body.data.title, 'Send Test Email');
    assert.strictEqual(res.body.data.type, 'EMAIL');
    assert.strictEqual(res.body.data.status, 'QUEUED');
    assert.strictEqual(res.body.data.priority, 'HIGH');
    assert.deepStrictEqual(res.body.data.payload, { to: 'hello@example.com', subject: 'Integration Test' });
  });

  test('POST /api/v1/jobs - default priority', async () => {
    const res = await request
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Send Test Email 2',
        type: 'EMAIL',
        payload: {},
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.priority, 'MEDIUM');
  });

  test('POST /api/v1/jobs - validation errors (missing fields, payload not object)', async () => {
    // Missing title
    let res = await request
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'EMAIL',
        payload: {},
      });
    assert.strictEqual(res.status, 400);

    // Missing type
    res = await request
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Title only',
        payload: {},
      });
    assert.strictEqual(res.status, 400);

    // Payload not an object
    res = await request
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Title',
        type: 'EMAIL',
        payload: 'not-an-object',
      });
    assert.strictEqual(res.status, 400);
  });

  // 2. Ownership & Authorization tests
  test('GET /api/v1/jobs/:id - owner vs unauthorized vs admin access', async () => {
    // Create Job for User A
    const jobRes = await request
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'User A Job',
        type: 'TEST',
        payload: {},
      });
    const jobId = jobRes.body.data.id;

    // User A can access it
    let res = await request
      .get(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.id, jobId);

    // User B CANNOT access it (403 Forbidden)
    res = await request
      .get(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /not authorized/);

    // Admin can access it
    res = await request
      .get(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.id, jobId);
  });

  // 3. Update Job tests
  test('PATCH /api/v1/jobs/:id - owner success & disallow extra fields', async () => {
    const jobRes = await request
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'User A Job',
        type: 'TEST',
        payload: {},
      });
    const jobId = jobRes.body.data.id;

    // Modify allowed fields
    let res = await request
      .patch(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Updated Title',
        description: 'New Description',
        priority: 'CRITICAL',
      });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.title, 'Updated Title');
    assert.strictEqual(res.body.data.description, 'New Description');
    assert.strictEqual(res.body.data.priority, 'CRITICAL');

    // Rejects unauthorized user
    res = await request
      .patch(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Hacker Title' });
    assert.strictEqual(res.status, 403);

    // Rejects forbidden field updates (id, userId, createdAt)
    res = await request
      .patch(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ userId: userBId });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /Validation failed/);
  });

  // 4. Cancel Job tests
  test('PATCH /api/v1/jobs/:id/cancel - allowed only if PENDING', async () => {
    const jobRes = await request
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'User A Cancel Job',
        type: 'TEST',
        payload: {},
      });
    const jobId = jobRes.body.data.id;

    // Cancel from PENDING -> Success
    let res = await request
      .patch(`/api/v1/jobs/${jobId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, 'CANCELLED');

    // Try to cancel again -> Fails because status is now CANCELLED
    res = await request
      .patch(`/api/v1/jobs/${jobId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /Only PENDING or QUEUED jobs can be cancelled/);
  });

  // 5. Soft Delete tests
  test('DELETE /api/v1/jobs/:id - owner soft deletes', async () => {
    const jobRes = await request
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'User A Delete Job',
        type: 'TEST',
        payload: {},
      });
    const jobId = jobRes.body.data.id;

    // Delete
    let res = await request
      .delete(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.strictEqual(res.status, 200);

    // Check GET by ID -> Not Found
    res = await request
      .get(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.strictEqual(res.status, 404);

    // Verify it is still in database physically
    const dbJob = await prisma.job.findUnique({ where: { id: jobId } });
    assert.ok(dbJob);
    assert.ok(dbJob.deletedAt);
  });

  // 6. Pagination & Filtering tests
  test('GET /api/v1/jobs - pagination and filtering support', async () => {
    // Create multiple jobs for A
    await request
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Job 1', type: 'EMAIL', priority: 'LOW', payload: {} });

    await request
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Job 2', type: 'SMS', priority: 'MEDIUM', payload: {} });

    await request
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Job 3', type: 'EMAIL', priority: 'HIGH', payload: {} });

    // User B job
    await request
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Job B', type: 'EMAIL', priority: 'HIGH', payload: {} });

    // Test GET /api/v1/jobs for User A (should get 3 jobs)
    let res = await request
      .get('/api/v1/jobs')
      .set('Authorization', `Bearer ${tokenA}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.jobs.length, 3);
    assert.strictEqual(res.body.total, 3);
    assert.strictEqual(res.body.page, 1);
    assert.strictEqual(res.body.limit, 10);

    // Test filtering by type=SMS
    res = await request
      .get('/api/v1/jobs?type=SMS')
      .set('Authorization', `Bearer ${tokenA}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.jobs.length, 1);
    assert.strictEqual(res.body.jobs[0].title, 'Job 2');

    // Test filtering by priority=HIGH
    res = await request
      .get('/api/v1/jobs?priority=HIGH')
      .set('Authorization', `Bearer ${tokenA}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.jobs.length, 1);
    assert.strictEqual(res.body.jobs[0].title, 'Job 3');

    // Test pagination limit=2
    res = await request
      .get('/api/v1/jobs?limit=2&page=1')
      .set('Authorization', `Bearer ${tokenA}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.jobs.length, 2);
    assert.strictEqual(res.body.total, 3);

    // Test Admin gets all jobs (3 from User A + 1 from User B = 4 jobs)
    res = await request
      .get('/api/v1/jobs')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 4);
  });
});
