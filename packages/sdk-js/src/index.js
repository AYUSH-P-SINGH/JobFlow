export class JobFlowClient {
    apiKey;
    baseUrl;
    constructor(options) {
        if (!options.apiKey) {
            throw new Error('API key is required to initialize JobFlowClient');
        }
        this.apiKey = options.apiKey;
        this.baseUrl = options.baseUrl || 'http://localhost:5000';
    }
    /**
     * Helper to make authenticated requests to the JobFlow API
     */
    async request(path, options = {}) {
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
    templates = {
        create: async (name, description, projectId) => {
            return this.request('/api/v1/workflows/templates', {
                method: 'POST',
                body: JSON.stringify({ name, description, projectId }),
            });
        },
        list: async () => {
            return this.request('/api/v1/workflows/templates');
        },
        createVersion: async (templateId, dsl) => {
            return this.request(`/api/v1/workflows/templates/${templateId}/versions`, {
                method: 'POST',
                body: JSON.stringify({ dsl }),
            });
        },
        run: async (templateId, options) => {
            return this.request(`/api/v1/workflows/templates/${templateId}/run`, {
                method: 'POST',
                body: JSON.stringify(options || {}),
            });
        },
        export: async (templateId) => {
            return this.request(`/api/v1/workflows/templates/${templateId}/export`);
        },
        import: async (importData) => {
            return this.request('/api/v1/workflows/templates/import', {
                method: 'POST',
                body: JSON.stringify(importData),
            });
        },
    };
    /**
     * Executed Workflow Run operations
     */
    workflows = {
        get: async (runId) => {
            return this.request(`/api/v1/workflows/${runId}`);
        },
        cancel: async (runId) => {
            return this.request(`/api/v1/workflows/${runId}/cancel`, {
                method: 'PATCH',
            });
        },
        retry: async (runId) => {
            return this.request(`/api/v1/workflows/${runId}/retry`, {
                method: 'POST',
            });
        },
    };
    /**
     * Job operations
     */
    jobs = {
        get: async (jobId) => {
            return this.request(`/api/v1/jobs/${jobId}`);
        },
    };
    /**
     * Webhook management
     */
    webhooks = {
        create: async (options) => {
            return this.request('/api/v1/webhooks', {
                method: 'POST',
                body: JSON.stringify(options),
            });
        },
        list: async () => {
            return this.request('/api/v1/webhooks');
        },
        delete: async (id) => {
            return this.request(`/api/v1/webhooks/${id}`, {
                method: 'DELETE',
            });
        },
    };
}
