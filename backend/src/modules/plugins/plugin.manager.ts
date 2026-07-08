import { HandlerFactory } from '../../workers/handlers/handler.factory.js';
import { BaseHandler } from '../../workers/handlers/base.handler.js';
import { logger } from '../../common/logger/logger.js';
import fs from 'fs';
import path from 'path';

export interface IPlugin {
  id: string;
  name: string;
  description: string;
  register(): Promise<void>;
  execute(payload: any): Promise<any>;
  cleanup(): Promise<void>;
}

export class PluginHandler extends BaseHandler {
  readonly type: string;
  private plugin: IPlugin;

  constructor(plugin: IPlugin) {
    super();
    this.type = plugin.id.toUpperCase();
    this.plugin = plugin;
  }

  async validate(payload: any): Promise<void> {
    // Basic validation of payload presence
    if (!payload) {
      throw new Error(`Payload is required for plugin ${this.plugin.name}`);
    }
  }

  async execute(payload: any, progress: (percent: number) => Promise<void>): Promise<any> {
    await progress(10);
    logger.info(`[PluginHandler] Executing plugin: ${this.plugin.name} (Type: ${this.type})`);
    const result = await this.plugin.execute(payload);
    await progress(100);
    return result;
  }
}

export class PluginManager {
  private static plugins = new Map<string, IPlugin>();

  /**
   * Register a plugin in the system
   */
  public static async registerPlugin(plugin: IPlugin): Promise<void> {
    await plugin.register();
    this.plugins.set(plugin.id.toUpperCase(), plugin);

    // Register this plugin in the HandlerFactory dynamically
    HandlerFactory.register(plugin.id, new PluginHandler(plugin));
    logger.info(`[PluginManager] Registered Plugin: ${plugin.name} (${plugin.id})`);
  }

  /**
   * Get list of all registered plugins
   */
  public static getPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }
}

// ==========================================
// 1. Built-in Slack Plugin
// ==========================================
export class SlackPlugin implements IPlugin {
  readonly id = 'SLACK_PLUGIN';
  readonly name = 'Slack Notifier';
  readonly description = 'Sends rich messages and notifications to Slack channels via webhooks';

  async register() {
    logger.info('[SlackPlugin] Registered successfully');
  }

  async execute(payload: any) {
    const { webhookUrl, message } = payload;
    if (!webhookUrl || !message) {
      throw new Error('webhookUrl and message are required for Slack notification');
    }

    logger.info(`[SlackPlugin] Dispatching message to Slack...`);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) {
      throw new Error(`Slack API returned status ${response.status}`);
    }

    return { success: true, status: 'delivered' };
  }

  async cleanup() {}
}

// ==========================================
// 2. Built-in GitHub Action Trigger Plugin
// ==========================================
export class GitHubPlugin implements IPlugin {
  readonly id = 'GITHUB_PLUGIN';
  readonly name = 'GitHub Action Trigger';
  readonly description = 'Triggers workflow dispatch events in GitHub repositories';

  async register() {
    logger.info('[GitHubPlugin] Registered successfully');
  }

  async execute(payload: any) {
    const { owner, repo, workflowId, ref, token, inputs } = payload;
    if (!owner || !repo || !workflowId || !ref || !token) {
      throw new Error('owner, repo, workflowId, ref, and token are required for GitHub action trigger');
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;
    logger.info(`[GitHubPlugin] Dispatching workflow trigger to GitHub: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'JobFlow-Plugin',
      },
      body: JSON.stringify({
        ref,
        inputs: inputs || {},
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned status ${response.status}`);
    }

    return { success: true, status: 'dispatched' };
  }

  async cleanup() {}
}

// ==========================================
// 3. Built-in PDF Compiler Plugin
// ==========================================
export class PdfPlugin implements IPlugin {
  readonly id = 'PDF_PLUGIN';
  readonly name = 'PDF Compiler';
  readonly description = 'Compiles documents and HTML templates into PDF files';

  async register() {
    logger.info('[PdfPlugin] Registered successfully');
  }

  async execute(payload: any) {
    const { content, filename } = payload;
    if (!content || !filename) {
      throw new Error('content and filename are required for PDF compilation');
    }

    // Simulate PDF generation by writing to a local scratch file
    const targetDir = path.join(process.cwd(), 'scratch');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, filename);
    const mockPdfContent = `%PDF-1.4\n%----\n${content}\n%----EOF`;
    fs.writeFileSync(targetPath, mockPdfContent);

    logger.info(`[PdfPlugin] PDF successfully generated and saved to: ${targetPath}`);
    return {
      success: true,
      filename,
      path: targetPath,
      size: mockPdfContent.length,
    };
  }

  async cleanup() {}
}

// Register all plugins on module load to verify integration
await PluginManager.registerPlugin(new SlackPlugin());
await PluginManager.registerPlugin(new GitHubPlugin());
await PluginManager.registerPlugin(new PdfPlugin());
