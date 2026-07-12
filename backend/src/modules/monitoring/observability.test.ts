import test from 'node:test';
import assert from 'assert';
import http from 'http';
import supertest from 'supertest';
import { io as Client } from 'socket.io-client';
import app from '../../app.js';
import prisma from '../../prisma.js';
import { initSocketServer, closeSocketServer } from '../../socket/socket.server.js';
import { eventBus } from '../../events/event.bus.js';
import { NotificationService } from '../notifications/notification.service.js';
import { AuditService } from './audit.service.js';
import { ActivityService } from './activity.service.js';
import { MetricsService } from './metrics.service.js';
import { runWithCorrelationId, getCorrelationId } from '../../common/tracing/context.js';

test.describe('Observability & Real-Time Monitoring Integration Tests', { concurrency: 1 }, () => {
  const request = supertest(app);
  let server: http.Server;
  let port: number;

  let userToken: string;
  let userId: string;
  let otherToken: string;
  let otherUserId: string;
  let adminToken: string;
  let adminId: string;

  test.before(async () => {
    // Start HTTP server on a random port for Socket.IO testing
    server = http.createServer(app);
    initSocketServer(server);
    
    // Initialize subscriptions
    NotificationService.initSubscriptions();
    AuditService.initSubscriptions();
    MetricsService.initSubscriptions();

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address();
        port = typeof address === 'string' ? 0 : address?.port || 0;
        resolve();
      });
    });
  });

  test.beforeEach(async () => {
    // Clear all DB tables
    await prisma.notification.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.workflowHistory.deleteMany({});
    await prisma.workflowStep.deleteMany({});
    await prisma.workflow.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.user.deleteMany({});

    // Register User A
    const resA = await request
      .post('/api/v1/auth/register')
      .send({ email: 'user.a@example.com', password: 'password123' });
    userToken = resA.body.data.accessToken;
    userId = resA.body.data.user.id;

    // Register User B
    const resB = await request
      .post('/api/v1/auth/register')
      .send({ email: 'user.b@example.com', password: 'password123' });
    otherToken = resB.body.data.accessToken;
    otherUserId = resB.body.data.user.id;

    // Register Admin
    const resAdmin = await request
      .post('/api/v1/auth/register')
      .send({ email: 'admin@example.com', password: 'password123' });
    adminId = resAdmin.body.data.user.id;

    // Promote to Admin
    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'ADMIN' },
    });

    const resLogin = await request
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'password123' });
    adminToken = resLogin.body.data.accessToken;
  });

  test.after(async () => {
    await closeSocketServer();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await prisma.$disconnect();
    try {
      const { redisConnection } = await import('../../config/redis.js');
      await redisConnection.quit();
    } catch {}
  });

  test('Event Bus - pub/sub custom events', async () => {
    let triggered = false;
    let payloadReceived: any = null;

    const unsubscribe = eventBus.subscribe('workflow.started', (data) => {
      triggered = true;
      payloadReceived = data;
    });

    const dummyWf = { id: 'dummy-wf', name: 'Dummy', userId } as any;
    eventBus.publish('workflow.started', { workflow: dummyWf, correlationId: 'cid-123' });

    assert.strictEqual(triggered, true);
    assert.strictEqual(payloadReceived.workflow.id, 'dummy-wf');
    assert.strictEqual(payloadReceived.correlationId, 'cid-123');

    unsubscribe();
  });

  test('Distributed Tracing - Correlation ID propagation in HTTP header and AsyncLocalStorage', async () => {
    const res = await request
      .get('/health')
      .set('x-correlation-id', 'test-cid-999');

    assert.strictEqual(res.headers['x-correlation-id'], 'test-cid-999');

    // Verify context.ts wrapper
    let cidInside: string | undefined;
    runWithCorrelationId('local-cid-888', () => {
      cidInside = getCorrelationId();
    });
    assert.strictEqual(cidInside, 'local-cid-888');
  });

  test('Socket.IO - JWT connection authentication', async () => {
    // 1. Connection with valid token succeeds
    const socket = Client(`http://localhost:${port}`, {
      auth: { token: userToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        socket.disconnect();
        resolve();
      });
      socket.on('connect_error', (err) => {
        reject(err);
      });
    });

    // 2. Connection with invalid token fails
    const badSocket = Client(`http://localhost:${port}`, {
      auth: { token: 'invalid-token' },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      badSocket.on('connect_error', (err) => {
        assert.match(err.message, /Token invalid/);
        badSocket.disconnect();
        resolve();
      });
    });
  });

  test('Socket.IO Rooms & Event Streaming', async () => {
    const socket = Client(`http://localhost:${port}`, {
      auth: { token: userToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => socket.on('connect', resolve));

    // Register a mock listener for workflow updates
    let updatedWf: any = null;
    socket.emit('join:workflow', { workflowId: 'wf-123' });
    socket.on('workflow.updated', (data: any) => {
      updatedWf = data;
    });

    // Trigger workflow event on event bus
    const workflowObj = { id: 'wf-123', name: 'Socket test', userId } as any;
    eventBus.publish('workflow.updated', { workflow: workflowObj });

    // Wait short delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(updatedWf);
    assert.strictEqual(updatedWf.workflow.id, 'wf-123');

    socket.disconnect();
  });

  test('Notifications CRUD and persistence', async () => {
    // Create notification
    const n = await NotificationService.createNotification(
      userId,
      'SUCCESS',
      'Task complete',
      'The background operation completed.'
    );

    // List notifications
    const resList = await request
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userToken}`);
    assert.strictEqual(resList.body.data.length, 1);
    assert.strictEqual(resList.body.data[0].id, n.id);

    // Mark as read
    const resRead = await request
      .patch(`/api/v1/notifications/${n.id}/read`)
      .set('Authorization', `Bearer ${userToken}`);
    assert.strictEqual(resRead.body.data.read, true);

    // Delete notification
    const resDel = await request
      .delete(`/api/v1/notifications/${n.id}`)
      .set('Authorization', `Bearer ${userToken}`);
    assert.strictEqual(resDel.status, 200);

    // List again -> empty
    const resList2 = await request
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userToken}`);
    assert.strictEqual(resList2.body.data.length, 0);
  });

  test('Audit logs capture', async () => {
    // Log login or custom action
    await AuditService.log(userId, 'Workflow Created', 'Workflow', { workflowId: 'wf-123' });

    const resLogs = await request
      .get('/api/v1/monitoring/logs')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(resLogs.status, 200);
    assert.strictEqual(resLogs.body.data.length, 2);
    assert.strictEqual(resLogs.body.data[0].action, 'Workflow Created');
  });

  test('Timeline generation', async () => {
    // Create workflow history
    const wf = await prisma.workflow.create({
      data: {
        name: 'Timeline test',
        userId,
        status: 'PENDING',
      },
    });

    await prisma.workflowHistory.create({
      data: {
        workflowId: wf.id,
        event: 'CREATED',
        message: 'Workflow created successfully',
      },
    });

    const resTimeline = await request
      .get(`/api/v1/monitoring/workflows/${wf.id}/timeline`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(resTimeline.status, 200);
    assert.strictEqual(resTimeline.body.data.length, 1);
    assert.strictEqual(resTimeline.body.data[0].event, 'CREATED');
  });

  test('Dashboard and Prometheus metrics & custom Phase 15 metrics', async () => {
    // Create completed job today
    await prisma.job.create({
      data: {
        title: 'Completed test',
        type: 'EMAIL',
        userId,
        status: 'COMPLETED',
        payload: {},
      },
    });

    // Check dashboard statistics
    const resDash = await request
      .get('/api/v1/monitoring/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(resDash.status, 200);
    assert.strictEqual(resDash.body.data.completedToday, 1);

    // Check Prometheus scrape output
    const resProm = await request.get('/metrics');
    assert.strictEqual(resProm.status, 200);
    assert.match(resProm.text, /process_cpu_seconds_total/);
    assert.match(resProm.text, /workflow_started_total/);
    assert.match(resProm.text, /workflow_completed_total/);
    assert.match(resProm.text, /workflow_failed_total/);
    assert.match(resProm.text, /jobflow_jobs_total/);
    assert.match(resProm.text, /workflow_duration/);
    assert.match(resProm.text, /queue_wait_time/);
    assert.match(resProm.text, /worker_utilization/);
    assert.match(resProm.text, /queue_waiting/);
    assert.match(resProm.text, /queue_active/);
  });

  test('OpenTelemetry - Tracing context propagation validation', async () => {
    const { workflowRepository } = await import('../workflow/workflow.repository.js');

    const traceContext: Record<string, string> = { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' };
    
    // Simulate repository create with triggerMetadata
    const steps = [
      { stepId: 'step-1', jobType: 'EMAIL', priority: 'MEDIUM' as any, payload: {}, dependsOn: [] }
    ];
    const wf = await workflowRepository.create('Propagate Test', userId, steps, { traceContext });
    
    assert.ok(wf.triggerMetadata);
    assert.deepStrictEqual((wf.triggerMetadata as any).traceContext, traceContext);
  });

  test('Logging - Custom Loki Winston transport does not throw when sending log logs', async () => {
    const { logger } = await import('../../common/logger/logger.js');
    logger.info('Test log event for Loki integration verification');
    // Ensure LokiTransport executes log processing without exceptions
    assert.ok(true);
  });
});
