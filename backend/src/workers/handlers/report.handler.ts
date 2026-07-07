import { z } from 'zod';
import { BaseHandler } from './base.handler.js';
import { logger } from '../../common/logger/logger.js';

const reportPayloadSchema = z.object({
  reportType: z.string().min(1, 'Report type cannot be empty'),
  format: z.enum(['pdf', 'csv', 'html', 'xlsx']),
});

export type ReportPayload = z.infer<typeof reportPayloadSchema>;

export interface ReportResult {
  generated: boolean;
  url: string;
  sizeBytes: number;
}

export class ReportHandler extends BaseHandler<ReportPayload, ReportResult> {
  readonly type = 'REPORT';

  async validate(payload: ReportPayload): Promise<void> {
    await reportPayloadSchema.parseAsync(payload);
  }

  async execute(
    payload: ReportPayload,
    progress: (percent: number) => Promise<void>
  ): Promise<ReportResult> {
    logger.info(`[ReportHandler] Initiating generation of ${payload.reportType} report in ${payload.format} format...`);

    const steps = [0, 25, 50, 75, 100];
    for (const step of steps) {
      await progress(step);
      if (step < 100) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }

    const timestamp = Date.now();
    const reportUrl = `https://storage.jobflow.com/reports/${payload.reportType.toLowerCase()}-${timestamp}.${payload.format}`;
    const mockSize = Math.floor(Math.random() * 50000) + 1024; // 1KB to 51KB

    logger.info(`[ReportHandler] Report successfully written to ${reportUrl} (${mockSize} bytes)`);
    return {
      generated: true,
      url: reportUrl,
      sizeBytes: mockSize,
    };
  }

  async rollback(payload: ReportPayload, error: Error): Promise<void> {
    logger.warn(`[ReportHandler] Clean up partial files for ${payload.reportType} report due to error: ${error.message}`);
  }
}
