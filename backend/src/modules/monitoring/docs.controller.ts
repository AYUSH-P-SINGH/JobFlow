import { Request, Response } from 'express';

const OPENAPI_SPEC = {
  openapi: '3.0.0',
  info: {
    title: 'JobFlow Enterprise API Reference',
    version: '1.0.0',
    description: 'Complete API reference for the JobFlow distributed workflow orchestration and template engine platform.',
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [
    { ApiKeyAuth: [] },
    { BearerAuth: [] },
  ],
  paths: {
    '/api/v1/auth/register': {
      post: {
        summary: 'Register a new user',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Registered successfully' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        summary: 'Login and get token',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Authenticated successfully' },
        },
      },
    },
    '/api/v1/tenants': {
      post: {
        summary: 'Register a new Tenant/Organization',
        tags: ['Tenancy'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', description: 'Organization name' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Tenant created successfully' },
        },
      },
    },
    '/api/v1/tenants/{tenantId}/keys': {
      post: {
        summary: 'Generate a new API Key for a Tenant',
        tags: ['Tenancy'],
        parameters: [
          { name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', description: 'Name identifier for key' },
                  expiresDays: { type: 'integer', description: 'Key expiry in days' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'API Key generated successfully' },
        },
      },
    },
    '/api/v1/workflows/templates': {
      post: {
        summary: 'Create a new Workflow Template',
        tags: ['Templates'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Template created successfully' },
        },
      },
      get: {
        summary: 'List all Workflow Templates',
        tags: ['Templates'],
        responses: {
          '200': { description: 'List of templates' },
        },
      },
    },
    '/api/v1/workflows/templates/{id}/versions': {
      post: {
        summary: 'Append a new version (JSON DSL) to a Template',
        tags: ['Templates'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['dsl'],
                properties: {
                  dsl: {
                    type: 'object',
                    required: ['name', 'steps'],
                    properties: {
                      name: { type: 'string' },
                      steps: { type: 'array', items: { type: 'object' } },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Version created successfully' },
        },
      },
    },
    '/api/v1/workflows/templates/{id}/run': {
      post: {
        summary: 'Execute a workflow run from a Template',
        tags: ['Templates'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  version: { type: 'integer', description: 'Specific version to run' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Execution started successfully' },
        },
      },
    },
    '/api/v1/schedules': {
      post: {
        summary: 'Create a new Cron-based Workflow execution schedule',
        tags: ['Scheduler'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'cron', 'templateId'],
                properties: {
                  name: { type: 'string' },
                  cron: { type: 'string', description: 'Standard crontab format' },
                  templateId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Schedule configured successfully' },
        },
      },
    },
    '/api/v1/webhooks': {
      post: {
        summary: 'Configure a Webhook trigger or callback',
        tags: ['Webhooks'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'type'],
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['INBOUND', 'OUTBOUND'] },
                  url: { type: 'string', description: 'Required for OUTBOUND type' },
                  events: { type: 'array', items: { type: 'string' } },
                  templateId: { type: 'string', description: 'Required for INBOUND type' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Webhook created' },
        },
      },
    },
    '/api/v1/workflows': {
      post: {
        summary: 'Create and start a new sequential/parallel/conditional workflow execution',
        tags: ['Workflows'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'steps'],
                properties: {
                  name: { type: 'string', description: 'Name of the workflow execution' },
                  steps: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['stepId', 'jobType', 'payload', 'dependsOn'],
                      properties: {
                        stepId: { type: 'string', description: 'Unique identifier for the step in this DAG' },
                        jobType: { type: 'string', description: 'Job type handler to execute' },
                        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                        payload: { type: 'object', description: 'Input variables for the job handler. Can include a "condition" string.' },
                        dependsOn: { type: 'array', items: { type: 'string' }, description: 'Step IDs this step depends on' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Workflow registered and execution started' },
          '400': { description: 'Invalid DAG definition (circular deps, missing references, duplicate IDs)' },
        },
      },
      get: {
        summary: 'List workflow executions',
        tags: ['Workflows'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] } },
        ],
        responses: {
          '200': { description: 'List of workflow executions' },
        },
      },
    },
    '/api/v1/workflows/metrics': {
      get: {
        summary: 'Get workflow orchestration statistics',
        tags: ['Workflows'],
        responses: {
          '200': { description: 'Orchestration metrics summary' },
        },
      },
    },
    '/api/v1/workflows/compare': {
      get: {
        summary: 'Compare two workflow execution topologies',
        tags: ['Workflows'],
        parameters: [
          { name: 'workflowIdA', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'workflowIdB', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Structural differences between workflow topologies' },
        },
      },
    },
    '/api/v1/workflows/{id}': {
      get: {
        summary: 'Get details of a specific workflow execution',
        tags: ['Workflows'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Workflow execution details including step details and history logs' },
          '404': { description: 'Workflow not found' },
        },
      },
    },
    '/api/v1/workflows/{id}/cancel': {
      patch: {
        summary: 'Cancel a pending or running workflow execution',
        tags: ['Workflows'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Workflow cancelled and active jobs terminated' },
        },
      },
    },
    '/api/v1/workflows/{id}/retry': {
      post: {
        summary: 'Retry a failed or cancelled workflow execution',
        tags: ['Workflows'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Workflow reset and scheduled steps restarted from the failure point' },
        },
      },
    },
    '/api/v1/monitoring/dashboard': {
      get: {
        summary: 'Get dashboard overview statistics',
        tags: ['Monitoring'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Overall statistics including active, failed, completed counts' },
        },
      },
    },
    '/api/v1/monitoring/queues': {
      get: {
        summary: 'Get details and size stats of queues',
        tags: ['Monitoring'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Queue metrics (waiting, active, completed, failed, delayed counts)' },
        },
      },
    },
    '/api/v1/monitoring/workflows': {
      get: {
        summary: 'List active workflow executions',
        tags: ['Monitoring'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Active workflows list' },
        },
      },
    },
    '/api/v1/monitoring/workers': {
      get: {
        summary: 'Get active workers and CPU/memory utilization statistics',
        tags: ['Monitoring'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Worker stats (status, cpu, memory, current job, uptime)' },
        },
      },
    },
    '/api/v1/monitoring/logs': {
      get: {
        summary: 'Query platform audit logs',
        tags: ['Monitoring'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'List of audit records' },
        },
      },
    },
    '/api/v1/monitoring/workflows/{id}/timeline': {
      get: {
        summary: 'Get workflow execution history logs as a timeline sequence',
        tags: ['Monitoring'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Timeline events array' },
        },
      },
    },
    '/api/v1/monitoring/analytics': {
      get: {
        summary: 'Get tenant analytics, execution throughput, and error rates',
        tags: ['Monitoring'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Tenant analytics details' },
        },
      },
    },
  },
};

export class DocsController {
  /**
   * Serve OpenAPI Specification in JSON format
   */
  public static getOpenApiJson(req: Request, res: Response): void {
    res.status(200).json(OPENAPI_SPEC);
  }

  /**
   * Render Interactive Swagger UI Page
   */
  public static renderSwaggerUi(req: Request, res: Response): void {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>JobFlow API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/v1/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
    `;
    res.status(200).send(html);
  }
}
