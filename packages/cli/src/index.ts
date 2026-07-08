#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import { JobFlowClient } from '../../sdk-js/dist/index.js';

const CONFIG_PATH = path.join(os.homedir(), '.jobflowrc');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Error: Not logged in. Please run: jobflow login <apiKey> [baseUrl]');
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (err) {
    console.error('Error reading configuration file:', err);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  switch (command) {
    case 'login': {
      const apiKey = args[1];
      const baseUrl = args[2] || 'http://localhost:5000';
      if (!apiKey) {
        console.error('Usage: jobflow login <apiKey> [baseUrl]');
        process.exit(1);
      }
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({ apiKey, baseUrl }, null, 2));
      console.log(`Successfully logged in! Configuration saved to ${CONFIG_PATH}`);
      break;
    }

    case 'deploy': {
      const dslFile = args[1];
      if (!dslFile) {
        console.error('Usage: jobflow deploy <dsl.json>');
        process.exit(1);
      }
      if (!fs.existsSync(dslFile)) {
        console.error(`Error: File "${dslFile}" not found.`);
        process.exit(1);
      }
      const config = loadConfig();
      const client = new JobFlowClient(config);
      try {
        const dsl = JSON.parse(fs.readFileSync(dslFile, 'utf8'));
        // 1. Create a template
        console.log(`Deploying workflow: "${dsl.name}"...`);
        const templateRes = await client.templates.create(dsl.name, dsl.description || 'Imported via CLI');
        const template = templateRes.data;
        // 2. Deploy version
        const versionRes = await client.templates.createVersion(template.id, dsl);
        const version = versionRes.data;
        console.log(`Workflow deployed successfully!`);
        console.log(`Template ID: ${template.id}`);
        console.log(`Version: ${version.version}`);
      } catch (err: any) {
        console.error('Deployment failed:', err.message);
        process.exit(1);
      }
      break;
    }

    case 'run': {
      const templateId = args[1];
      if (!templateId) {
        console.error('Usage: jobflow run <template-id>');
        process.exit(1);
      }
      const config = loadConfig();
      const client = new JobFlowClient(config);
      try {
        console.log(`Triggering template run: ${templateId}...`);
        const runRes = await client.templates.run(templateId, { triggerType: 'CLI' });
        const run = runRes.data;
        console.log(`Workflow run started!`);
        console.log(`Execution ID: ${run.id}`);
        console.log(`Status: ${run.status}`);
      } catch (err: any) {
        console.error('Execution trigger failed:', err.message);
        process.exit(1);
      }
      break;
    }

    case 'status': {
      const runId = args[1];
      if (!runId) {
        console.error('Usage: jobflow status <run-id>');
        process.exit(1);
      }
      const config = loadConfig();
      const client = new JobFlowClient(config);
      try {
        const run = (await client.workflows.get(runId)).data;
        console.log(`Workflow Run ID: ${run.id}`);
        console.log(`Name: ${run.name}`);
        console.log(`Status: ${run.status}`);
        console.log(`Progress: ${run.progress}%`);
        console.log(`Current Step: ${run.currentStep || 'None'}`);
      } catch (err: any) {
        console.error('Failed to fetch status:', err.message);
        process.exit(1);
      }
      break;
    }

    case 'logs': {
      const runId = args[1];
      if (!runId) {
        console.error('Usage: jobflow logs <run-id>');
        process.exit(1);
      }
      const config = loadConfig();
      const client = new JobFlowClient(config);
      try {
        const run = (await client.workflows.get(runId)).data;
        console.log(`--- Event Logs for Run: ${runId} ---`);
        if (!run.histories || run.histories.length === 0) {
          console.log('No logs found.');
        } else {
          for (const log of run.histories) {
            console.log(`[${new Date(log.createdAt).toLocaleTimeString()}] ${log.event}: ${log.message}`);
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch logs:', err.message);
        process.exit(1);
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
JobFlow CLI - Command Line Tool for JobFlow

Usage:
  jobflow <command> [arguments]

Commands:
  login <apiKey> [baseUrl]   Login to JobFlow using an API Key
  deploy <dsl.json>          Parse, validate, and deploy a JSON DSL template
  run <template-id>          Trigger an execution of a workflow template
  status <run-id>            View execution status and progress
  logs <run-id>              Display event history and logs for a run

Options:
  -h, --help                 Show this help message
`);
}

main();
