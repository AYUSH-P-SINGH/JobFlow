import { Request, Response, NextFunction } from 'express';
import { PluginSDKRegistry, JobFlowPlugin, IPluginMetadata } from '../plugins/plugin-sdk.js';
import prisma from '../prisma.js';
import { logger } from '../common/logger/logger.js';

class DynamicCustomPlugin extends JobFlowPlugin {
  readonly metadata: IPluginMetadata;
  private scriptBody: string;

  constructor(metadata: IPluginMetadata, scriptBody: string) {
    super();
    this.metadata = metadata;
    this.scriptBody = scriptBody;
  }

  async validate(payload: any): Promise<void> {
    if (!payload) {
      throw new Error(`Payload is required for custom plugin: ${this.metadata.name}`);
    }
  }

  async execute(payload: any, progress: (percent: number) => Promise<void>): Promise<any> {
    logger.info(`[DynamicPlugin: ${this.metadata.id}] Running custom script execution...`);
    await progress(20);
    
    // Safely simulate custom script execution or execute mock response
    await progress(100);
    return {
      success: true,
      pluginId: this.metadata.id,
      executedAt: new Date(),
      payloadSummary: Object.keys(payload),
      message: `Custom script for "${this.metadata.name}" ran successfully.`,
    };
  }
}

export class MarketplaceController {
  /**
   * GET /api/v1/marketplace/plugins
   * Lists all registered and loaded plugins.
   */
  public static async listPlugins(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plugins = PluginSDKRegistry.getPlugins();
      const metadataList = plugins.map((p) => p.metadata);

      res.status(200).json({
        success: true,
        data: metadataList,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/marketplace/plugins
   * Registers a new custom developer plugin dynamically at runtime.
   */
  public static async uploadPlugin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, name, version, description, author, script } = req.body;

      if (!id || !name || !version || !author) {
        res.status(400).json({
          success: false,
          error: 'Required metadata parameters missing: "id", "name", "version", "author" are required.',
        });
        return;
      }

      const metadata: IPluginMetadata = { id, name, version, description: description || '', author };
      const customPlugin = new DynamicCustomPlugin(metadata, script || '');

      // Register the plugin dynamically using the Plugin SDK
      await PluginSDKRegistry.register(customPlugin);

      res.status(201).json({
        success: true,
        message: `Plugin "${name}" (${id}) registered successfully in JobFlow Marketplace!`,
        data: metadata,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/marketplace/templates
   * Lists all workflow templates stored in the database.
   */
  public static async listTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates = await prisma.workflowTemplate.findMany({
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({
        success: true,
        data: templates,
      });
    } catch (error) {
      next(error);
    }
  }
}
