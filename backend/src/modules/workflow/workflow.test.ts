import test, { mock } from 'node:test';
import assert from 'node:assert';
import supertest from 'supertest';
import app from '../../app.js';
import prisma from '../../prisma.js';
import { EnqueueService } from '../jobs/enqueue.service.js';
import { ExecutionService } from '../jobs/execution.service.js';
import { WorkflowStatus } from './workflow.types.js';
import { initJobQueue } from '../../queues/job.queue.js';

test.describe('Workflow Module Integration Tests', { concurrency: 1 }, () => {
  const request = supertest(app);

  test.before(() => {
    initJobQueue();
  });

  // Mock EnqueueService to automatically trigger execution in-process after a short delay
  mock.method(EnqueueService, 'enqueueJob', async (job: any) => {
    setTimeout(async () => {
      try {
        const dummyBullJob = {
          data: { jobId: job.id },
          attemptsMade: 0,
          updateProgress: async (pct: number) => {},
        } as any;
        await ExecutionService.executeJob(job.id, dummyBullJob);
      } catch (err) {
        // ignore async errors during test execution
      }
    }, 10);
    return { id: job.id } as any;
  });

  let token: string;
  let userId: string;

  let otherToken: string;
  let otherUserId: string;

  let adminToken: string;

  test.beforeEach(async () => {
    // Clean up DB tables
    await prisma.workflowHistory.deleteMany({});
    await prisma.workflowStep.deleteMany({});
    await prisma.workflow.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.user.deleteMany({});

    // Register User A
    const resA = await request
      .post('/api/v1/auth/register')
      .send({ email: 'wfuser@example.com', password: 'password123' });
    token = resA.body.data.accessToken;
    userId = resA.body.data.user.id;

    // Register User B
    const resB = await request
      .post('/api/v1/auth/register')
      .send({ email: 'wfother@example.com', password: 'password123' });
    otherToken = resB.body.data.accessToken;
    otherUserId = resB.body.data.user.id;

    // Register Admin
    const resAdmin = await request
      .post('/api/v1/auth/register')
      .send({ email: 'wfadmin@example.com', password: 'password123' });
    const adminId = resAdmin.body.data.user.id;

    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'ADMIN' },
    });

    const resLogin = await request
      .post('/api/v1/auth/login')
      .send({ email: 'wfadmin@example.com', password: 'password123' });
    adminToken = resLogin.body.data.accessToken;
  });

  test.after(async () => {
    await prisma.$disconnect();
    try {
      const { closeAllQueues } = await import('../../queues/queue.factory.js');
      await closeAllQueues();
    } catch {}
    try {
      const { redisConnection } = await import('../../config/redis.js');
      await redisConnection.quit();
    } catch {}
  });

  // Helper to poll for workflow completion/terminal status in tests to avoid test race conditions
  async function waitForWorkflow(wfId: string): Promise<any> {
    const start = Date.now();
    while (Date.now() - start < 4000) {
      const res = await request
        .get(`/api/v1/workflows/${wfId}`)
        .set('Authorization', `Bearer ${token}`);
      const status = res.body?.data?.status;
      if (status === WorkflowStatus.COMPLETED || status === WorkflowStatus.FAILED || status === WorkflowStatus.CANCELLED) {
        return res.body.data;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const finalRes = await request
      .get(`/api/v1/workflows/${wfId}`)
      .set('Authorization', `Bearer ${token}`);
    return finalRes.body.data;
  }

  // 1. Validation tests
  test('POST /api/v1/workflows - validation errors', async () => {
    // Empty steps array
    const resEmpty = await request
      .post('/api/v1/workflows')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Empty Workflow', steps: [] });

    assert.strictEqual(resEmpty.status, 400);

    // Duplicate step IDs
    const resDuplicate = await request
      .post('/api/v1/workflows')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Duplicate Steps',
        steps: [
          { stepId: 'step-a', jobType: 'EMAIL', payload: {}, dependsOn: [] },
          { stepId: 'step-a', jobType: 'REPORT', payload: {}, dependsOn: [] },
        ],
      });
    assert.strictEqual(resDuplicate.status, 400);
    assert.ok(JSON.stringify(resDuplicate.body.errors).includes('unique'));

    // Non-existent dependency
    const resMissingDep = await request
      .post('/api/v1/workflows')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Missing Dep',
        steps: [
          { stepId: 'step-a', jobType: 'EMAIL', payload: {}, dependsOn: ['step-b'] },
        ],
      });
    assert.strictEqual(resMissingDep.status, 400);
    assert.ok(JSON.stringify(resMissingDep.body.errors).includes('Dependencies must reference existing'));

    // Circular dependency
    const resCycle = await request
      .post('/api/v1/workflows')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Cycle Workflow',
        steps: [
          { stepId: 'step-a', jobType: 'EMAIL', payload: {}, dependsOn: ['step-b'] },
          { stepId: 'step-b', jobType: 'REPORT', payload: {}, dependsOn: ['step-a'] },
        ],
      });
    assert.strictEqual(resCycle.status, 400);
    assert.ok(JSON.stringify(resCycle.body.errors).includes('Circular dependencies'));
  });

  // 2. Sequential Execution
  test('POST /api/v1/workflows - sequential execution success', async () => {
    const res = await request
      .post('/api/v1/workflows')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Sequential Pipeline',
        steps: [
          {
            stepId: 'step-1',
            jobType: 'EMAIL',
            payload: { to: 't1@example.com', subject: 'Subject A', body: 'Body A' },
            dependsOn: [],
          },
          {
            stepId: 'step-2',
            jobType: 'NOTIFICATION',
            payload: { recipientId: 'user-1', message: 'Task completed successfully' },
            dependsOn: ['step-1'],
          },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    const wfId = res.body.data.id;
    assert.ok(wfId);

    // Wait for the async workflow execution to run to completion
    const workflow = await waitForWorkflow(wfId);

    assert.strictEqual(workflow.status, WorkflowStatus.COMPLETED);
    assert.strictEqual(workflow.progress, 100);

    const steps = workflow.steps;
    assert.strictEqual(steps.length, 2);
    assert.strictEqual(steps[0].status, WorkflowStatus.COMPLETED);
    assert.strictEqual(steps[1].status, WorkflowStatus.COMPLETED);
    assert.ok(steps[0].startedAt);
    assert.ok(steps[0].completedAt);

    // Verify history events exists
    const histories = workflow.histories;
    assert.ok(histories.length >= 4);
  });

  // 3. Parallel Execution
  test('POST /api/v1/workflows - parallel branches execution', async () => {
    const res = await request
      .post('/api/v1/workflows')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Parallel Pipeline',
        steps: [
          {
            stepId: 'start',
            jobType: 'REPORT',
            payload: { reportType: 'Startup Analytics', format: 'csv' },
            dependsOn: [],
          },
          {
            stepId: 'branch-a',
            jobType: 'EMAIL',
            payload: { to: 'a@example.com', subject: 'Branch A', body: 'Report is ready' },
            dependsOn: ['start'],
          },
          {
            stepId: 'branch-b',
            jobType: 'NOTIFICATION',
            payload: { recipientId: 'user-admin', message: 'Report generated successfully' },
            dependsOn: ['start'],
          },
          {
            stepId: 'join',
            jobType: 'IMAGE',
            payload: { imageUrl: 'https://images.com/report-graph.png', operation: 'crop' },
            dependsOn: ['branch-a', 'branch-b'],
          },
        ],
      });

    assert.strictEqual(res.status, 201);
    const wfId = res.body.data.id;

    const workflow = await waitForWorkflow(wfId);

    assert.strictEqual(workflow.status, WorkflowStatus.COMPLETED);
    assert.strictEqual(workflow.progress, 100);
    const steps = workflow.steps;
    assert.strictEqual(steps.find((s: any) => s.stepId === 'join').status, WorkflowStatus.COMPLETED);
  });

  // 4. Conditional Steps & Branching
  test('POST /api/v1/workflows - conditional branching (skip / cancel path)', async () => {
    const res = await request
      .post('/api/v1/workflows')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Conditional Pipeline',
        steps: [
          {
            stepId: 'check-payment',
            jobType: 'REPORT',
            payload: { reportType: 'Payment Query', format: 'xlsx' },
            dependsOn: [],
          },
          {
            stepId: 'invoice-success',
            jobType: 'EMAIL',
            payload: {
              to: 'success@example.com',
              subject: 'Receipt',
              body: 'Thank you!',
              condition: "steps.check-payment.status === 'COMPLETED'",
            },
            dependsOn: ['check-payment'],
          },
          {
            stepId: 'refund-failure',
            jobType: 'NOTIFICATION',
            payload: {
              recipientId: 'finance-team',
              message: 'Rollback required',
              condition: "steps.check-payment.status === 'FAILED'",
            },
            dependsOn: ['check-payment'],
          },
          {
            stepId: 'notify-refund-sent',
            jobType: 'EMAIL',
            payload: { to: 'customer@example.com', subject: 'Refund Sent', body: 'Sorry for the trouble' },
            dependsOn: ['refund-failure'], // Downstream dependency of skipped step
          },
        ],
      });

    assert.strictEqual(res.status, 201);
    const wfId = res.body.data.id;

    const workflow = await waitForWorkflow(wfId);

    assert.strictEqual(workflow.status, WorkflowStatus.COMPLETED);
    assert.strictEqual(workflow.progress, 100);

    const stepInvoice = workflow.steps.find((s: any) => s.stepId === 'invoice-success');
    const stepRefund = workflow.steps.find((s: any) => s.stepId === 'refund-failure');
    const stepNotifyRefund = workflow.steps.find((s: any) => s.stepId === 'notify-refund-sent');

    assert.strictEqual(stepInvoice.status, WorkflowStatus.COMPLETED);
    assert.strictEqual(stepRefund.status, WorkflowStatus.CANCELLED);
    assert.strictEqual(stepNotifyRefund.status, WorkflowStatus.CANCELLED);
  });

  // 5. Cancellation
  test('PATCH /api/v1/workflows/:id/cancel - cancel workflow and remaining steps', async () => {
    // Override EnqueueService mock to NOT trigger execution immediately, simulating long execution
    mock.reset(); // restores the mock
    mock.method(EnqueueService, 'enqueueJob', async (job: any) => {
      // Just return dummy job but do NOT run ExecutionService
      return { id: job.id } as any;
    });

    const res = await request
      .post('/api/v1/workflows')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Slow Pipeline',
        steps: [
          {
            stepId: 'step-1',
            jobType: 'EMAIL',
            payload: { to: 'slow@example.com', subject: 'Slow', body: 'Running' },
            dependsOn: [],
          },
          {
            stepId: 'step-2',
            jobType: 'NOTIFICATION',
            payload: { recipientId: 'admin', message: 'Alert' },
            dependsOn: ['step-1'],
          },
        ],
      });

    const wfId = res.body.data.id;

    // Give time to trigger initial schedulers
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Cancel workflow
    const resCancel = await request
      .patch(`/api/v1/workflows/${wfId}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(resCancel.status, 200);
    assert.strictEqual(resCancel.body.data.status, WorkflowStatus.CANCELLED);

    const resGet = await request
      .get(`/api/v1/workflows/${wfId}`)
      .set('Authorization', `Bearer ${token}`);

    const workflow = resGet.body.data;
    assert.strictEqual(workflow.status, WorkflowStatus.CANCELLED);
    assert.strictEqual(workflow.progress, 100);

    const step1 = workflow.steps.find((s: any) => s.stepId === 'step-1');
    const step2 = workflow.steps.find((s: any) => s.stepId === 'step-2');

    assert.strictEqual(step1.status, WorkflowStatus.CANCELLED);
    assert.strictEqual(step2.status, WorkflowStatus.CANCELLED);

    // Restore standard mock for subsequent tests
    mock.reset();
  });

  // 6. Templates
  test('GET /api/v1/workflows/templates - retrieves workflow templates list', async () => {
    const res = await request
      .get('/api/v1/workflows/templates')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 4);
    assert.strictEqual(res.body.data[0].id, 'email-campaign');
  });

  // 7. Metrics
  test('GET /api/v1/workflows/metrics - retrieves overall workflow execution metrics', async () => {
    const res = await request
      .get('/api/v1/workflows/metrics')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.activeWorkflows !== undefined);
    assert.ok(res.body.data.successRate !== undefined);
  });
});
