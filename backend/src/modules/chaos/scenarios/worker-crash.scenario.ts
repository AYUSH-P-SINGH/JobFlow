import { Worker } from 'bullmq';
import { QueueNames } from '../../../queues/queue.constants.js';
import { createQueueOptions } from '../../../config/bullmq.js';
import { logger } from '../../../common/logger/logger.js';
import { RecoveryService } from '../../recovery/recovery.service.js';
import prisma from '../../../prisma.js';

export async function runWorkerCrashScenario(): Promise<boolean> {
  logger.info('--- Running Chaos Scenario: Worker Crash ---');

  // 1. Create a dummy workflow
  const workflow = await prisma.workflow.create({
    data: {
      name: 'Chaos Test Workflow',
      status: 'RUNNING',
      userId: 'admin-id-1234',
    },
  });

  const step = await prisma.workflowStep.create({
    data: {
      workflowId: workflow.id,
      stepId: 'chaos-step-1',
      stepNumber: 1,
      jobType: 'EMAIL',
      status: 'RUNNING', // Mark as running to simulate crash
      jobId: 'chaos-job-id-999',
      payload: {},
      dependsOn: [],
    },
  });

  logger.info(`Workflow ${workflow.id} initialized with running step ${step.stepId}`);

  // 2. Execute Recovery Scan
  logger.info('Simulating worker restart and triggering Recovery Engine...');
  await RecoveryService.recoverRunningWorkflows();

  // 3. Verify step status was reset to PENDING
  const updatedStep = await prisma.workflowStep.findUnique({
    where: { id: step.id },
  });

  const recovered = updatedStep?.status === 'PENDING';
  
  if (recovered) {
    logger.info('SUCCESS: Worker crash recovered. Interrupted step reset to PENDING.');
  } else {
    logger.error(`FAILURE: Interrupted step status is still "${updatedStep?.status}"`);
  }

  // Cleanup
  await prisma.workflow.delete({ where: { id: workflow.id } });

  return recovered;
}
