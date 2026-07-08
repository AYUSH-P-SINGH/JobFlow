import prisma from '../../prisma.js';
import { DslParser } from './engine/dsl.parser.js';
import { WorkflowStatus, JobPriority } from './workflow.types.js';
import { WorkflowEngine } from './engine/workflow.engine.js';
import { workflowRepository } from './workflow.repository.js';
import { WORKFLOW_EVENTS } from './workflow.constants.js';
import { NotFoundError, BadRequestError } from '../../common/errors/errors.js';
import { logger } from '../../common/logger/logger.js';

export class TemplateService {
  /**
   * Create a new Workflow Template
   */
  public static async createTemplate(
    name: string,
    description: string | undefined,
    tenantId: string,
    projectId?: string
  ) {
    return prisma.workflowTemplate.create({
      data: {
        name,
        description,
        tenantId,
        projectId: projectId || 'default-project-id',
      },
    });
  }

  /**
   * Create a new version for a template using JSON DSL
   */
  public static async createVersion(
    templateId: string,
    dslContent: unknown,
    tenantId: string
  ) {
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!template) {
      throw new NotFoundError('Workflow Template not found');
    }

    // Validate and parse DSL
    const parsedDsl = DslParser.parse(dslContent);

    // Get the latest version number
    const latestVersion = await prisma.workflowVersion.findFirst({
      where: { templateId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latestVersion?.version || 0) + 1;

    // Deactivate previous versions
    await prisma.workflowVersion.updateMany({
      where: { templateId, isActive: true },
      data: { isActive: false },
    });

    const versionRecord = await prisma.workflowVersion.create({
      data: {
        templateId,
        version: nextVersion,
        dsl: parsedDsl as any,
        isActive: true,
      },
    });

    logger.info(`Created Workflow Version ${nextVersion} for Template ${templateId}`);
    return versionRecord;
  }

  /**
   * Start execution of a workflow run using the active or a specific version of a template
   */
  public static async startExecution(
    templateId: string,
    userId: string,
    tenantId: string,
    versionNumber?: number,
    triggerType: string = 'MANUAL',
    triggerMetadata: any = null
  ) {
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!template) {
      throw new NotFoundError('Workflow Template not found');
    }

    // Find the version to run
    const versionClause = versionNumber
      ? { templateId, version: versionNumber }
      : { templateId, isActive: true };

    const versionRecord = await prisma.workflowVersion.findFirst({
      where: versionClause,
    });

    if (!versionRecord) {
      throw new BadRequestError(
        versionNumber
          ? `Version ${versionNumber} not found for template`
          : 'No active version found for template'
      );
    }

    const dsl = versionRecord.dsl as any;
    const steps = dsl.steps;

    // Create the workflow run execution instance (Workflow table)
    const run = await prisma.$transaction(async (tx) => {
      const workflowRun = await tx.workflow.create({
        data: {
          name: `${template.name} (v${versionRecord.version})`,
          userId,
          tenantId,
          projectId: template.projectId,
          versionId: versionRecord.id,
          status: WorkflowStatus.PENDING,
          progress: 0.0,
          triggerType,
          triggerMetadata,
        },
      });

      const stepsData = steps.map((step: any, idx: number) => ({
        workflowId: workflowRun.id,
        stepId: step.stepId,
        stepNumber: idx + 1,
        jobType: step.jobType,
        priority: (step.priority as JobPriority) || JobPriority.MEDIUM,
        payload: step.payload || {},
        dependsOn: step.dependsOn || [],
        status: WorkflowStatus.PENDING,
      }));

      await tx.workflowStep.createMany({
        data: stepsData,
      });

      return workflowRun;
    });

    // Record created event history
    await workflowRepository.addHistory(
      run.id,
      WORKFLOW_EVENTS.CREATED,
      `Workflow run created from template "${template.name}" version ${versionRecord.version} via ${triggerType}.`
    );

    // Trigger initial execution step evaluation in background
    WorkflowEngine.tick(run.id).catch((err) => {
      logger.error(`[TemplateService] Error starting run ${run.id}: ${err.message}`);
    });

    return prisma.workflow.findUnique({
      where: { id: run.id },
      include: {
        steps: { orderBy: { stepNumber: 'asc' } },
      },
    });
  }
}
