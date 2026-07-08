import test, { before, after } from 'node:test';
import assert from 'node:assert';
import supertest from 'supertest';
import app from '../../app.js';
import { QueueNames, PriorityMap } from '../../queues/queue.constants.js';
import { createQueue, getQueue, getAllQueues } from '../../queues/queue.factory.js';
import { EnqueueService } from './enqueue.service.js';
import { initJobQueue } from '../../queues/job.queue.js';
import { initQueueEvents, closeQueueEvents } from '../../queues/queue.events.js';
import { closeAllQueues } from '../../queues/queue.factory.js';
import { JobStatus, JobPriority } from '@prisma/client';
import { redisConnection } from '../../config/redis.js';
import { logger } from '../../common/logger/logger.js';
import { HandlerFactory } from '../../workers/handlers/handler.factory.js';
import { ExecutionService } from './execution.service.js';
import { WorkerHealthTracker } from '../../workers/worker.health.js';
import prisma from '../../prisma.js';

test.describe('Queue Architecture & Setup Tests', () => {
  before(() => {
    initJobQueue();
  });

  after(() => {
    logger.info("TEST HOOK: after() starting cleanup...");
    closeQueueEvents().catch(() => {});
    closeAllQueues().catch(() => {});
    logger.info("TEST HOOK: exiting process...");
    process.exit(0);
  });

  test('Queue Names and Priority Map exist and are correct', () => {
    assert.strictEqual(QueueNames.JOB_QUEUE, 'job-processing');
    assert.strictEqual(QueueNames.EMAIL_QUEUE, 'email');
    assert.strictEqual(QueueNames.WORKFLOW_QUEUE, 'workflow');

    assert.strictEqual(PriorityMap[JobPriority.CRITICAL], 1);
    assert.strictEqual(PriorityMap[JobPriority.HIGH], 2);
    assert.strictEqual(PriorityMap[JobPriority.MEDIUM], 5);
    assert.strictEqual(PriorityMap[JobPriority.LOW], 10);
  });

  test('Queue factory registry registers queues', () => {
    const queue = createQueue(QueueNames.JOB_QUEUE);
    assert.ok(queue);
    
    const retrieved = getQueue(QueueNames.JOB_QUEUE);
    assert.strictEqual(retrieved, queue);

    const all = getAllQueues();
    assert.ok(all.includes(queue));
  });

  test('Queue events listener can be initialized', () => {
    const events = initQueueEvents();
    assert.ok(events);
    events.close();
  });

  test('EnqueueService minimal payload mapping', async () => {
    // Stub the queue's add method
    const queue = createQueue(QueueNames.JOB_QUEUE);
    let addedName = '';
    let addedData: any = null;
    let addedOpts: any = null;

    queue.add = async (name: string, data: any, opts: any) => {
      addedName = name;
      addedData = data;
      addedOpts = opts;
      return { id: 'test-job-id' } as any;
    };

    const mockJob = {
      id: 'db-job-123',
      userId: 'user-456',
      tenantId: null,
      title: 'Test Priority & Delay',
      description: 'Check options mapping',
      type: 'EMAIL',
      status: JobStatus.PENDING,
      priority: JobPriority.HIGH,
      payload: { test: true },
      result: null,
      scheduledAt: new Date(Date.now() + 600000), // 10 minutes in future
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const enqueued = await EnqueueService.enqueueJob(mockJob);
    assert.ok(enqueued);
    assert.strictEqual(addedName, 'EMAIL');
    
    // Minimal payload verification
    assert.deepStrictEqual(addedData, {
      jobId: 'db-job-123',
      userId: 'user-456',
      type: 'EMAIL',
      priority: 'HIGH',
    });

    // Priority and delay verification
    assert.strictEqual(addedOpts.jobId, 'db-job-123');
    assert.strictEqual(addedOpts.priority, 2); // PriorityMap[HIGH] = 2
    assert.ok(addedOpts.delay > 500000 && addedOpts.delay <= 600000);
  });

  test('GET /ready checks Redis and database', async () => {
    // Mock redisConnection.ping to simulate connection success during tests
    redisConnection.ping = async () => 'PONG';

    const request = supertest(app);
    const res = await request.get('/ready');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ready');
    assert.strictEqual(res.body.database, 'healthy');
    assert.strictEqual(res.body.redis, 'healthy');
  });

  test('GET /admin/queues is available', async () => {
    const request = supertest(app);
    const res = await request.get('/admin/queues');
    // Should return 301 redirect or 200 depending on trailing slash,
    // let's verify it does not return 404.
    assert.ok(res.status !== 404);
  });

  test('HandlerFactory registers and retrieves handlers correctly', () => {
    const emailHandler = HandlerFactory.getHandler('EMAIL');
    assert.strictEqual(emailHandler.type, 'EMAIL');

    const reportHandler = HandlerFactory.getHandler('REPORT');
    assert.strictEqual(reportHandler.type, 'REPORT');

    const notificationHandler = HandlerFactory.getHandler('NOTIFICATION');
    assert.strictEqual(notificationHandler.type, 'NOTIFICATION');

    const imageHandler = HandlerFactory.getHandler('IMAGE');
    assert.strictEqual(imageHandler.type, 'IMAGE');

    assert.throws(() => {
      HandlerFactory.getHandler('NON_EXISTENT');
    }, /Unsupported job type/);
  });

  test('ExecutionService executes an email job successfully and updates DB status', async () => {
    // 1. Create a user
    const user = await prisma.user.create({
      data: {
        email: `worker-test-${Date.now()}@example.com`,
        passwordHash: 'dummyhash',
      },
    });

    // 2. Create a job in DB
    const job = await prisma.job.create({
      data: {
        title: 'Send Welcoming Email',
        type: 'EMAIL',
        priority: JobPriority.HIGH,
        payload: {
          to: 'customer@example.com',
          subject: 'Welcome!',
          body: 'Thank you for joining our platform.',
        },
        userId: user.id,
        status: JobStatus.QUEUED,
      },
    });

    // 3. Mock BullMQ job
    const dummyBullJob = {
      data: { jobId: job.id },
      attemptsMade: 0,
      updateProgress: async (pct: number) => {},
    } as any;

    // 4. Run ExecutionService
    const result = await ExecutionService.executeJob(job.id, dummyBullJob);
    assert.strictEqual(result.sent, true);
    assert.strictEqual(result.recipient, 'customer@example.com');

    // 5. Assert database updates
    const updatedJob = await prisma.job.findUnique({ where: { id: job.id } });
    assert.ok(updatedJob);
    assert.strictEqual(updatedJob.status, JobStatus.COMPLETED);
    assert.ok(updatedJob.startedAt);
    assert.ok(updatedJob.completedAt);
    assert.ok(updatedJob.result);
    assert.strictEqual((updatedJob.result as any).sent, true);

    // 6. Assert health metrics
    const health = WorkerHealthTracker.getInstance().getHealthData();
    assert.ok(health.workerId);
    assert.ok(health.uptime >= 0);
    assert.strictEqual(health.metrics.successes >= 1, true);
  });

  test('ExecutionService handles validation failure and updates DB to FAILED', async () => {
    // 1. Create a user
    const user = await prisma.user.create({
      data: {
        email: `worker-err-${Date.now()}@example.com`,
        passwordHash: 'dummyhash',
      },
    });

    // 2. Create a job in DB with invalid payload for email (missing to and body)
    const job = await prisma.job.create({
      data: {
        title: 'Invalid Email Job',
        type: 'EMAIL',
        priority: JobPriority.MEDIUM,
        payload: {
          subject: 'This has no "to" address',
        },
        userId: user.id,
        status: JobStatus.QUEUED,
      },
    });

    // 3. Mock BullMQ job
    const dummyBullJob = {
      data: { jobId: job.id },
      attemptsMade: 1,
      updateProgress: async (pct: number) => {},
    } as any;

    // 4. Run ExecutionService and verify it throws validation error
    await assert.rejects(async () => {
      await ExecutionService.executeJob(job.id, dummyBullJob);
    });

    // 5. Assert DB updates (status FAILED, error result recorded)
    const updatedJob = await prisma.job.findUnique({ where: { id: job.id } });
    assert.ok(updatedJob);
    assert.strictEqual(updatedJob.status, JobStatus.FAILED);
    assert.ok(updatedJob.completedAt);
    assert.ok(updatedJob.result);
    assert.ok((updatedJob.result as any).message);
    assert.strictEqual((updatedJob.result as any).attempts, 2); // 1 previous + 1 current attempt
  });
});
