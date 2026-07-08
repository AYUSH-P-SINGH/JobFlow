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
