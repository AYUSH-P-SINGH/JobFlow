import { HandlerFactory } from '../workers/handlers/handler.factory.js';
import { BaseHandler } from '../workers/handlers/base.handler.js';
import { logger } from '../common/logger/logger.js';

export interface IPluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
}

/**
 * Base Abstract class representing a JobFlow Ecosystem Plugin.
 * Developers subclass this to register custom step types in JobFlow.
 */
export abstract class JobFlowPlugin<TPayload = any, TResult = any> {
  abstract readonly metadata: IPluginMetadata;

  /**
   * Called during initialization when the plugin is registered in the engine.
   */
  async initialize(): Promise<void> {
    logger.info(`[PluginSDK] Initializing plugin: ${this.metadata.name} (v${this.metadata.version})`);
  }

  /**
   * Business validation for input parameters.
   */
  abstract validate(payload: TPayload): void | Promise<void>;

  /**
   * Execution logic when a workflow step of this plugin type runs.
   */
  abstract execute(
    payload: TPayload,
    progress: (percent: number) => Promise<void>
  ): Promise<TResult>;

  /**
   * Optional rollback mechanism to execute in case of subsequent DAG execution failures.
   */
  async rollback?(payload: TPayload, error: Error): Promise<void> {
    logger.warn(`[PluginSDK] Rollback skipped for plugin: ${this.metadata.name}`);
  }
}

/**
 * Adapter that wraps a JobFlowPlugin as a BaseHandler to register in the HandlerFactory.
 */
class PluginHandlerAdapter extends BaseHandler {
  readonly type: string;
  private plugin: JobFlowPlugin;

  constructor(plugin: JobFlowPlugin) {
    super();
    this.type = plugin.metadata.id.toUpperCase();
    this.plugin = plugin;
  }

  async validate(payload: any): Promise<void> {
    await this.plugin.validate(payload);
  }

  async execute(payload: any, progress: (percent: number) => Promise<void>): Promise<any> {
    logger.info(`[PluginSDK] Delegating execution to plugin: ${this.plugin.metadata.name}`);
    return await this.plugin.execute(payload, progress);
  }

  async rollback(payload: any, error: Error): Promise<void> {
    if (this.plugin.rollback) {
      await this.plugin.rollback(payload, error);
    }
  }
}

export class PluginSDKRegistry {
  private static registeredPlugins = new Map<string, JobFlowPlugin>();

  /**
   * Instantiates and registers a new plugin in the JobFlow platform ecosystem.
   */
  public static async register(plugin: JobFlowPlugin): Promise<void> {
    const pluginId = plugin.metadata.id.toUpperCase();

    if (this.registeredPlugins.has(pluginId)) {
      logger.warn(`[PluginSDK] Plugin with ID "${pluginId}" is already registered. Overwriting.`);
    }

    try {
      await plugin.initialize();
      this.registeredPlugins.set(pluginId, plugin);

      // Adapt and register in HandlerFactory
      const handler = new PluginHandlerAdapter(plugin);
      HandlerFactory.register(pluginId, handler);

      logger.info(`[PluginSDK] Successfully registered and loaded plugin: ${plugin.metadata.name} (${pluginId})`);
    } catch (error) {
      logger.error(`[PluginSDK] Failed to register plugin "${plugin.metadata.name}": ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Retrieves a list of currently registered ecosystem plugins.
   */
  public static getPlugins(): JobFlowPlugin[] {
    return Array.from(this.registeredPlugins.values());
  }

  /**
   * Retrieves a registered plugin by ID.
   */
  public static getPlugin(id: string): JobFlowPlugin | undefined {
    return this.registeredPlugins.get(id.toUpperCase());
  }
}
