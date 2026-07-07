import { z } from 'zod';
import { BaseHandler } from './base.handler.js';
import { logger } from '../../common/logger/logger.js';

const imagePayloadSchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
  operation: z.enum(['resize', 'crop', 'grayscale', 'rotate']),
});

export type ImagePayload = z.infer<typeof imagePayloadSchema>;

export interface ImageResult {
  processed: boolean;
  outputUrl: string;
  dimensions: {
    width: number;
    height: number;
  };
}

export class ImageHandler extends BaseHandler<ImagePayload, ImageResult> {
  readonly type = 'IMAGE';

  async validate(payload: ImagePayload): Promise<void> {
    await imagePayloadSchema.parseAsync(payload);
  }

  async execute(
    payload: ImagePayload,
    progress: (percent: number) => Promise<void>
  ): Promise<ImageResult> {
    logger.info(`[ImageHandler] Executing ${payload.operation} on ${payload.imageUrl}...`);

    await progress(0);
    await new Promise((resolve) => setTimeout(resolve, 150));

    await progress(30);
    await new Promise((resolve) => setTimeout(resolve, 150));

    await progress(70);
    await new Promise((resolve) => setTimeout(resolve, 150));

    await progress(100);

    const filename = payload.imageUrl.substring(payload.imageUrl.lastIndexOf('/') + 1);
    const outputUrl = `https://storage.jobflow.com/processed/${payload.operation}_${filename}`;

    logger.info(`[ImageHandler] Image processing complete. Output saved to ${outputUrl}`);
    return {
      processed: true,
      outputUrl,
      dimensions: {
        width: 1920,
        height: 1080,
      },
    };
  }

  async rollback(payload: ImagePayload, error: Error): Promise<void> {
    logger.warn(`[ImageHandler] Rollback image processing for ${payload.imageUrl}: ${error.message}`);
  }
}
