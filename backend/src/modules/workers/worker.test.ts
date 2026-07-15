import test from 'node:test';
import assert from 'node:assert';
import supertest from 'supertest';
import app from '../../app.js';
import prisma from '../../prisma.js';
import { WorkerRegistry } from './scheduler/worker.registry.js';
import { WorkerSelection } from './scheduler/worker.selection.js';
import { IntelligentScheduler } from './scheduler/worker.scheduler.js';
import { SchedulerPolicy } from './worker.constants.js';
import { WorkerStatus } from '@prisma/client';

test.describe('Worker Management Module Tests', { concurrency: 1 }, () => {
  const request = supertest(app);

  test.beforeEach(async () => {
    // Clear worker_nodes table before each test
    await prisma.workerNode.deleteMany({});
    // Sync the registry cache
    await WorkerRegistry.sync();
  });

  // ─── API Integration Tests ───

  test.describe('Worker API Endpoints', () => {
    test('should register a new worker successfully and set status to READY', async () => {
      const res = await request
        .post('/api/v1/workers/register')
        .send({
          hostname: 'test-worker-1',
          port: 5002,
          region: 'us-west-1',
          tags: ['gpu', 'priority'],
          cpu: 8,
          memory: 16384,
          gpu: true,
          supportedJobs: ['AI', 'IMAGE'],
          concurrency: 10,
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.message, 'Worker registered successfully');
      assert.ok(res.body.worker.id);
      assert.strictEqual(res.body.worker.hostname, 'test-worker-1');
      assert.strictEqual(res.body.worker.status, 'READY'); // Auto-promoted to READY
      assert.strictEqual(res.body.worker.gpu, true);
      assert.deepEqual(res.body.worker.tags, ['gpu', 'priority']);
    });

    test('should accept heartbeat updates and update status based on runningJobs', async () => {
      // 1. Register a worker
      const regRes = await request
        .post('/api/v1/workers/register')
        .send({ hostname: 'test-worker-2', supportedJobs: ['EMAIL'] });
      const workerId = regRes.body.worker.id;

      // 2. Send heartbeat with runningJobs = 3 -> should transition to BUSY
      const hbRes1 = await request
        .post(`/api/v1/workers/${workerId}/heartbeat`)
        .send({
          runningJobs: 3,
          completedJobs: 10,
          failedJobs: 1,
          currentLoad: 0.6,
        });

      assert.strictEqual(hbRes1.status, 200);
      assert.strictEqual(hbRes1.body.worker.status, 'BUSY');
      assert.strictEqual(hbRes1.body.worker.runningJobs, 3);

      // 3. Send heartbeat with runningJobs = 0 -> should transition back to READY
      const hbRes2 = await request
        .post(`/api/v1/workers/${workerId}/heartbeat`)
        .send({
          runningJobs: 0,
          completedJobs: 13,
          failedJobs: 1,
          currentLoad: 0.0,
        });

      assert.strictEqual(hbRes2.status, 200);
      assert.strictEqual(hbRes2.body.worker.status, 'READY');
      assert.strictEqual(hbRes2.body.worker.runningJobs, 0);
    });

    test('should list workers with optional filters', async () => {
      // Register worker 1
      await request.post('/api/v1/workers/register').send({ hostname: 'w1', supportedJobs: ['EMAIL'] });
      // Register worker 2
      const reg2 = await request.post('/api/v1/workers/register').send({ hostname: 'w2', supportedJobs: ['PDF'] });
      const w2Id = reg2.body.worker.id;

      // Drain worker 2
      await request.post(`/api/v1/workers/${w2Id}/drain`).send({ reason: 'testing drain' });

      // List all
      const listAll = await request.get('/api/v1/workers');
      assert.strictEqual(listAll.status, 200);
      assert.strictEqual(listAll.body.count, 2);

      // List filtered by READY
      const listReady = await request.get('/api/v1/workers?status=READY');
      assert.strictEqual(listReady.status, 200);
      assert.strictEqual(listReady.body.count, 1);
      assert.strictEqual(listReady.body.workers[0].hostname, 'w1');
    });

    test('should drain a worker and transition its status to DRAINING', async () => {
      const reg = await request.post('/api/v1/workers/register').send({ hostname: 'w-drain', supportedJobs: ['AI'] });
      const workerId = reg.body.worker.id;

      const res = await request.post(`/api/v1/workers/${workerId}/drain`).send({ reason: 'maintenance' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.worker.status, 'DRAINING');
    });

    test('should deregister a worker and set status to OFFLINE', async () => {
      const reg = await request.post('/api/v1/workers/register').send({ hostname: 'w-del', supportedJobs: ['VIDEO'] });
      const workerId = reg.body.worker.id;

      const res = await request.delete(`/api/v1/workers/${workerId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'OFFLINE');

      const dbWorker = await prisma.workerNode.findUnique({ where: { id: workerId } });
      assert.strictEqual(dbWorker?.status, 'OFFLINE');
    });
  });

  // ─── Unit / Logical Tests for Selection and Scheduling ───

  test.describe('WorkerSelection Logic', () => {
    const createMockWorker = (overrides: Partial<any> = {}): any => ({
      id: `w-${Math.random().toString(36).substring(2, 6)}`,
      hostname: 'test-host',
      port: 5001,
      status: 'READY',
      region: 'default',
      tags: [],
      cpu: 4,
      memory: 4096,
      gpu: false,
      supportedJobs: ['EMAIL'],
      concurrency: 5,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      currentLoad: 0.0,
      lastHeartbeat: new Date(),
      startedAt: new Date(),
      updatedAt: new Date(),
      queueName: null,
      ...overrides,
    });

    test('LeastLoaded strategy should select worker with lowest load', () => {
      const workers = [
        createMockWorker({ id: 'w1', currentLoad: 0.6 }),
        createMockWorker({ id: 'w2', currentLoad: 0.1 }),
        createMockWorker({ id: 'w3', currentLoad: 0.4 }),
      ];

      const selected = WorkerSelection.select(workers, SchedulerPolicy.LEAST_LOADED);
      assert.strictEqual(selected?.id, 'w2');
    });

    test('LeastLoaded strategy should tie-break using runningJobs', () => {
      const workers = [
        createMockWorker({ id: 'w1', currentLoad: 0.5, runningJobs: 3 }),
        createMockWorker({ id: 'w2', currentLoad: 0.5, runningJobs: 1 }),
        createMockWorker({ id: 'w3', currentLoad: 0.5, runningJobs: 2 }),
      ];

      const selected = WorkerSelection.select(workers, SchedulerPolicy.LEAST_LOADED);
      assert.strictEqual(selected?.id, 'w2');
    });

    test('RoundRobin strategy should rotate through workers', () => {
      const workers = [
        createMockWorker({ id: 'w1' }),
        createMockWorker({ id: 'w2' }),
      ];

      const s1 = WorkerSelection.select(workers, SchedulerPolicy.ROUND_ROBIN);
      const s2 = WorkerSelection.select(workers, SchedulerPolicy.ROUND_ROBIN);
      const s3 = WorkerSelection.select(workers, SchedulerPolicy.ROUND_ROBIN);

      assert.notStrictEqual(s1?.id, s2?.id);
      assert.strictEqual(s1?.id, s3?.id);
    });

    test('Priority strategy should prefer workers tagged priority', () => {
      const workers = [
        createMockWorker({ id: 'w1', tags: [], currentLoad: 0.0 }),
        createMockWorker({ id: 'w2', tags: ['priority'], currentLoad: 0.5 }),
        createMockWorker({ id: 'w3', tags: ['priority'], currentLoad: 0.2 }),
      ];

      const selected = WorkerSelection.select(workers, SchedulerPolicy.PRIORITY);
      assert.strictEqual(selected?.id, 'w3'); // Priority tagged and least loaded among them
    });
  });

  // ─── Intelligent Scheduler Tests ───

  test.describe('IntelligentScheduler Integration', () => {
    test('should route job to specialized worker and its specialized queue', async () => {
      // Register specialized worker
      const reg = await request
        .post('/api/v1/workers/register')
        .send({
          hostname: 'pdf-worker',
          supportedJobs: ['PDF'],
          queueName: 'pdf-processing',
        });
      const workerId = reg.body.worker.id;

      // Sync registry
      await WorkerRegistry.sync();

      // Set policy
      IntelligentScheduler.setPolicy(SchedulerPolicy.CAPABILITY_MATCH);

      // Schedule PDF job
      const result = await IntelligentScheduler.scheduleJob('PDF');
      assert.strictEqual(result.workerId, workerId);
      assert.strictEqual(result.queueName, 'pdf-processing');
      assert.strictEqual(result.candidateCount, 1);
    });

    test('should fallback to default queue if no capable worker is online', async () => {
      // Schedule IMAGE job (no worker supports it)
      const result = await IntelligentScheduler.scheduleJob('IMAGE');
      assert.strictEqual(result.workerId, null);
      assert.strictEqual(result.queueName, 'job-processing'); // fallback queue
      assert.strictEqual(result.candidateCount, 0);
    });
  });
});
