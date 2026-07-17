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

    case 'create': {
      const templateName = args[1] || 'my-workflow';
      const filepath = path.join(process.cwd(), `${templateName}.json`);
      const skeleton = {
        name: templateName,
        description: 'Scaffolded via JobFlow CLI',
        steps: [
          {
            stepId: 'fetch-data',
            jobType: 'HTTP',
            priority: 'MEDIUM',
            payload: { url: 'https://api.example.com/data' },
            dependsOn: []
          },
          {
            stepId: 'send-email',
            jobType: 'EMAIL',
            priority: 'LOW',
            payload: { to: 'admin@example.com', subject: 'Workflow Complete' },
            dependsOn: ['fetch-data']
          }
        ]
      };
      fs.writeFileSync(filepath, JSON.stringify(skeleton, null, 2));
      console.log(`Successfully created workflow scaffold at: ${filepath}`);
      break;
    }

    case 'workflow': {
      const subCommand = args[1];
      if (!subCommand) {
        console.error('Usage: jobflow workflow <deploy|run|status|logs|list>');
        process.exit(1);
      }
      
      const config = loadConfig();
      const client = new JobFlowClient(config);

      switch (subCommand) {
        case 'deploy': {
          const dslFile = args[2];
          if (!dslFile || !fs.existsSync(dslFile)) {
            console.error('Usage: jobflow workflow deploy <dsl.json>');
            process.exit(1);
          }
          const dsl = JSON.parse(fs.readFileSync(dslFile, 'utf8'));
          console.log(`Deploying workflow: "${dsl.name}"...`);
          try {
            const templateRes = await client.templates.create(dsl.name, dsl.description || 'Imported via CLI');
            const template = templateRes.data;
            const versionRes = await client.templates.createVersion(template.id, dsl);
            console.log(`Workflow deployed successfully!`);
            console.log(`Template ID: ${template.id}`);
            console.log(`Version: ${versionRes.data.version}`);
          } catch (err: any) {
            console.error('Deployment failed:', err.message);
            process.exit(1);
          }
          break;
        }
        case 'run': {
          const templateId = args[2];
          if (!templateId) {
            console.error('Usage: jobflow workflow run <template-id>');
            process.exit(1);
          }
          try {
            const runRes = await client.templates.run(templateId, { triggerType: 'CLI' });
            console.log(`Workflow run started!`);
            console.log(`Execution ID: ${runRes.data.id}`);
            console.log(`Status: ${runRes.data.status}`);
          } catch (err: any) {
            console.error('Trigger failed:', err.message);
            process.exit(1);
          }
          break;
        }
        case 'status': {
          const runId = args[2];
          if (!runId) {
            console.error('Usage: jobflow workflow status <run-id>');
            process.exit(1);
          }
          try {
            const run = (await client.workflows.get(runId)).data;
            console.log(`Workflow Run: ${run.name} (${run.id})`);
            console.log(`Status: ${run.status}`);
            console.log(`Progress: ${run.progress}%`);
            console.log(`Current Step: ${run.currentStep || 'None'}`);
          } catch (err: any) {
            console.error('Failed to get status:', err.message);
            process.exit(1);
          }
          break;
        }
        case 'logs': {
          const runId = args[2];
          if (!runId) {
            console.error('Usage: jobflow workflow logs <run-id>');
            process.exit(1);
          }
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
        case 'list': {
          try {
            const res = await client.templates.list();
            console.log('--- Workflow Templates ---');
            for (const t of res.data) {
              console.log(`- ${t.name} (ID: ${t.id})`);
            }
          } catch (err: any) {
            console.error('Failed to list workflows:', err.message);
            process.exit(1);
          }
          break;
        }
        default:
          console.error(`Unknown workflow subcommand: ${subCommand}`);
          process.exit(1);
      }
      break;
    }

    case 'worker': {
      const subCommand = args[1];
      if (!subCommand) {
        console.error('Usage: jobflow worker <list|metrics|drain> [args]');
        process.exit(1);
      }

      const config = loadConfig();
      const client = new JobFlowClient(config);

      switch (subCommand) {
        case 'list': {
          try {
            const res = await client.workers.list();
            const workers = res.data.workers || res.data;
            console.log('--- Active Worker Nodes ---');
            if (workers.length === 0) {
              console.log('No workers registered.');
            } else {
              for (const w of workers) {
                console.log(`- ${w.hostname} (Status: ${w.status}, Load: ${Math.round(w.currentLoad * 100)}%, Queue: ${w.queueName || 'default'}) [ID: ${w.id}]`);
              }
            }
          } catch (err: any) {
            console.error('Failed to list workers:', err.message);
            process.exit(1);
          }
          break;
        }
        case 'metrics': {
          try {
            const res = await client.workers.metrics();
            console.log('--- Cluster Worker Metrics ---');
            console.log(`Total CPU Cores: ${res.data.totalCpu}`);
            console.log(`Total Memory: ${res.data.totalMemory} MB`);
            console.log(`Average Load: ${Math.round(res.data.averageLoad * 100)}%`);
            console.log(`Running Jobs: ${res.data.runningJobs}`);
          } catch (err: any) {
            console.error('Failed to fetch cluster metrics:', err.message);
            process.exit(1);
          }
          break;
        }
        case 'drain': {
          const workerId = args[2];
          if (!workerId) {
            console.error('Usage: jobflow worker drain <worker-id>');
            process.exit(1);
          }
          try {
            await client.workers.drain(workerId);
            console.log(`Successfully triggered drain mode on worker node: ${workerId}`);
          } catch (err: any) {
            console.error('Failed to drain worker:', err.message);
            process.exit(1);
          }
          break;
        }
        default:
          console.error(`Unknown worker subcommand: ${subCommand}`);
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
  login <apiKey> [baseUrl]      Login to JobFlow using an API Key
  create [name]                 Scaffold a new workflow JSON file template
  workflow <subcommand>         Manage workflows (deploy, run, status, logs, list)
  worker <subcommand>           Manage workers (list, metrics, drain)
  deploy <dsl.json>             Parse, validate, and deploy a JSON DSL template
  run <template-id>             Trigger an execution of a workflow template
  status <run-id>               View execution status and progress
  logs <run-id>                 Display event history and logs for a run

Options:
  -h, --help                    Show this help message
`);
}

main();
