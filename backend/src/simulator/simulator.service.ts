import { HandlerFactory } from '../workers/handlers/handler.factory.js';
import { PolicyEngine } from '../modules/governance/policy.engine.js';
import { logger } from '../common/logger/logger.js';

export interface ProposedStep {
  stepId: string;
  name: string;
  jobType: string;
  payload: Record<string, any>;
  dependsOn: string[];
}

export interface SimulationReport {
  valid: boolean;
  errors: string[];
  estimatedRuntimeMs: number;
  executionPath: string[][]; // steps that can run concurrently in stages
}

export class SimulatorService {
  /**
   * Performs static analysis and simulates execution of a proposed workflow configuration.
   * Does NOT write to the database or enqueue any real jobs.
   */
  public static async simulate(
    steps: ProposedStep[],
    userId: string,
    tenantId: string | null
  ): Promise<SimulationReport> {
    logger.info(`[Simulator] Starting simulation for workflow with ${steps.length} steps...`);

    const errors: string[] = [];
    let executionPath: string[][] = [];
    let estimatedRuntimeMs = 0;

    if (!steps || steps.length === 0) {
      return { valid: false, errors: ['Workflow must contain at least one step.'], estimatedRuntimeMs: 0, executionPath: [] };
    }

    // 1. Cycle Detection & Topo Sort
    try {
      executionPath = this.resolveExecutionStages(steps);
    } catch (err) {
      errors.push((err as Error).message);
    }

    // 2. Validate handlers & step payloads
    for (const step of steps) {
      // Check if handler exists
      let handler;
      try {
        handler = HandlerFactory.getHandler(step.jobType);
      } catch (err) {
        errors.push(`Step "${step.stepId}" uses unsupported jobType "${step.jobType}" (No handler registered).`);
        continue;
      }

      // Check payload validity
      try {
        await handler.validate(step.payload);
      } catch (err) {
        errors.push(`Step "${step.stepId}" payload validation failed: ${(err as Error).message}`);
      }
    }

    // 3. Evaluate Policies
    try {
      await PolicyEngine.evaluate(userId, tenantId, steps);
    } catch (err) {
      errors.push(`Policy Engine violation: ${(err as Error).message}`);
    }

    // 4. Estimate Parallel Runtime
    // Standard durations: EMAIL = 200ms, REPORT = 200ms, IMAGE = 200ms, others = 100ms
    if (errors.length === 0 && executionPath.length > 0) {
      for (const stage of executionPath) {
        let maxStageTime = 0;
        for (const stepId of stage) {
          const step = steps.find((s) => s.stepId === stepId);
          let duration = 100; // default delay
          if (step) {
            if (step.jobType === 'EMAIL' || step.jobType === 'REPORT' || step.jobType === 'IMAGE') {
              duration = 200; // Simulated latency
            }
          }
          if (duration > maxStageTime) {
            maxStageTime = duration;
          }
        }
        estimatedRuntimeMs += maxStageTime;
      }
    }

    const valid = errors.length === 0;
    logger.info(`[Simulator] Simulation finished. Status: ${valid ? 'SUCCESS' : 'FAILED'}. Errors found: ${errors.length}`);

    return {
      valid,
      errors,
      estimatedRuntimeMs,
      executionPath,
    };
  }

  /**
   * Helper to perform Kahn's algorithm and group steps into parallel execution stages.
   * Throws an error if a cycle is detected.
   */
  private static resolveExecutionStages(steps: ProposedStep[]): string[][] {
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const allStepIds = new Set(steps.map((s) => s.stepId));

    // Initialize degrees
    for (const stepId of allStepIds) {
      adjList.set(stepId, []);
      inDegree.set(stepId, 0);
    }

    // Build DAG adjacency
    for (const step of steps) {
      for (const parent of step.dependsOn) {
        if (!allStepIds.has(parent)) {
          throw new Error(`Step "${step.stepId}" depends on step "${parent}" which does not exist in the workflow.`);
        }
        adjList.get(parent)!.push(step.stepId);
        inDegree.set(step.stepId, inDegree.get(step.stepId)! + 1);
      }
    }

    // Run Kahn's algorithm to resolve stages
    let queue: string[] = [];
    for (const [stepId, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(stepId);
      }
    }

    const stages: string[][] = [];
    let visitedCount = 0;

    while (queue.length > 0) {
      stages.push([...queue]);
      const nextQueue: string[] = [];

      for (const u of queue) {
        visitedCount++;
        const neighbors = adjList.get(u) || [];
        for (const v of neighbors) {
          inDegree.set(v, inDegree.get(v)! - 1);
          if (inDegree.get(v) === 0) {
            nextQueue.push(v);
          }
        }
      }

      queue = nextQueue;
    }

    if (visitedCount !== steps.length) {
      throw new Error('Workflow contains circular dependencies (infinite loops detected).');
    }

    return stages;
  }
}
