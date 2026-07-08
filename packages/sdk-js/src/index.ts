export interface JobFlowClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export class JobFlowClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: JobFlowClientOptions) {
    if (!options.apiKey) {
      throw new Error('API key is required to initialize JobFlowClient');
    }
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'http://localhost:5000';
  }

  /**
   * Helper to make authenticated requests to the JobFlow API
   */
  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const errorMsg = data && typeof data === 'object' ? data.error || JSON.stringify(data) : data;
      throw new Error(`JobFlow API Error: ${response.status} - ${errorMsg}`);
    }

    return data;
  }

  /**
   * Templates and Versioning operations
   */
  public templates = {
    create: async (name: string, description?: string, projectId?: string) => {
      return this.request('/api/v1/workflows/templates', {
        method: 'POST',
        body: JSON.stringify({ name, description, projectId }),
      });
    },

    list: async () => {
      return this.request('/api/v1/workflows/templates');
    },

    createVersion: async (templateId: string, dsl: any) => {
      return this.request(`/api/v1/workflows/templates/${templateId}/versions`, {
        method: 'POST',
        body: JSON.stringify({ dsl }),
      });
    },

    run: async (templateId: string, options?: { version?: number; triggerType?: string; triggerMetadata?: any }) => {
      return this.request(`/api/v1/workflows/templates/${templateId}/run`, {
        method: 'POST',
        body: JSON.stringify(options || {}),
      });
    },

    export: async (templateId: string) => {
      return this.request(`/api/v1/workflows/templates/${templateId}/export`);
    },

    import: async (importData: { template: { name: string; description?: string }; dsl: any }) => {
      return this.request('/api/v1/workflows/templates/import', {
        method: 'POST',
        body: JSON.stringify(importData),
      });
    },
  };

  /**
   * Executed Workflow Run operations
   */
  public workflows = {
    get: async (runId: string) => {
      return this.request(`/api/v1/workflows/${runId}`);
    },

    cancel: async (runId: string) => {
      return this.request(`/api/v1/workflows/${runId}/cancel`, {
        method: 'PATCH',
      });
    },

    retry: async (runId: string) => {
      return this.request(`/api/v1/workflows/${runId}/retry`, {
        method: 'POST',
      });
    },
  };

  /**
   * Job operations
   */
  public jobs = {
    get: async (jobId: string) => {
      return this.request(`/api/v1/jobs/${jobId}`);
    },
  };

  /**
   * Webhook management
   */
  public webhooks = {
    create: async (options: {
      name: string;
      url?: string;
      events?: string[];
      secret?: string;
      type: 'INBOUND' | 'OUTBOUND';
      templateId?: string;
    }) => {
      return this.request('/api/v1/webhooks', {
        method: 'POST',
        body: JSON.stringify(options),
      });
    },

    list: async () => {
      return this.request('/api/v1/webhooks');
    },

    delete: async (id: string) => {
      return this.request(`/api/v1/webhooks/${id}`, {
        method: 'DELETE',
      });
    },
  };
}
