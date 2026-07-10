import { Request, Response } from 'express';
import prisma from '../prisma.js';
import { logger } from '../common/logger/logger.js';

export class GraphQLGateway {
  /**
   * Co-exists with REST to resolve GraphQL queries for workflows and steps.
   * Leverages a highly resilient resolver mapping.
   */
  public static async handle(req: Request, res: Response): Promise<void> {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        errors: [{ message: 'GraphQL query must be a string.' }],
      });
      return;
    }

    logger.debug(`[GraphQLGateway] Processing GraphQL Query: ${query.replace(/\s+/g, ' ')}`);

    try {
      // 1. Resolve workflow query: workflow(id: "...") { ... }
      const workflowIdMatch = query.match(/workflow\s*\(\s*id\s*:\s*["']([^"']+)["']\s*\)/i);

      if (workflowIdMatch) {
        const workflowId = workflowIdMatch[1];
        const workflow = await prisma.workflow.findUnique({
          where: { id: workflowId },
          include: { steps: true },
        });

        if (!workflow) {
          res.status(200).json({
            data: { workflow: null },
            errors: [{ message: `Workflow with ID "${workflowId}" not found.` }],
          });
          return;
        }

        // Build dynamic response based on fields requested in query (e.g. status, progress, steps)
        const responseData: Record<string, any> = {
          id: workflow.id,
          name: workflow.name,
        };

        if (query.includes('status')) {
          responseData.status = workflow.status;
        }

        if (query.includes('progress')) {
          responseData.progress = workflow.progress;
        }

        if (query.includes('steps')) {
          responseData.steps = workflow.steps.map((s) => {
            const stepObj: Record<string, any> = { stepId: s.stepId };
            if (query.includes('status')) stepObj.status = s.status;
            // Since steps schema has no progress, map completed/running state or stepNumber
            if (query.includes('progress')) {
              stepObj.progress = s.status === 'COMPLETED' ? 100 : s.status === 'PENDING' ? 0 : 50;
            }
            return stepObj;
          });
        }

        res.status(200).json({
          data: {
            workflow: responseData,
          },
        });
        return;
      }

      // 2. Fallback: Generic list of workflows
      if (query.includes('workflows')) {
        const workflows = await prisma.workflow.findMany({
          take: 10,
          include: { steps: true },
        });

        const listData = workflows.map((wf) => ({
          id: wf.id,
          name: wf.name,
          status: wf.status,
          progress: wf.progress,
        }));

        res.status(200).json({
          data: {
            workflows: listData,
          },
        });
        return;
      }

      // If query form is unrecognized, return descriptive error
      res.status(400).json({
        errors: [{ message: 'Unsupported GraphQL query structure. JobFlow currently supports workflow(id) and workflows queries.' }],
      });

    } catch (err) {
      logger.error(`GraphQL processing exception: ${(err as Error).message}`);
      res.status(500).json({
        errors: [{ message: 'Internal Server Error during GraphQL execution.' }],
      });
    }
  }
}
