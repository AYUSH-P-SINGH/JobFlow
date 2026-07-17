const DEFAULT_API_URL = 'http://localhost:5000';

export interface WorkflowStepDSL {
  stepId: string;
  jobType: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  payload: any;
  dependsOn: string[];
}

export interface WorkflowDSL {
  name: string;
  description?: string;
  steps: WorkflowStepDSL[];
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = localStorage.getItem('jobflow_api_url') || DEFAULT_API_URL;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url;
    localStorage.setItem('jobflow_api_url', url);
  }

  public getBaseUrl() {
    return this.baseUrl;
  }

  private getHeaders(authRequired = true): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (authRequired) {
      const token = localStorage.getItem('jobflow_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  private async request(path: string, options: RequestInit = {}, authRequired = true): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers = this.getHeaders(authRequired);
    const config = {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    };

    let response = await fetch(url, config);

    // If unauthorized, attempt token refresh once
    if (response.status === 401 && authRequired && localStorage.getItem('jobflow_refresh_token')) {
      const success = await this.refreshTokens();
      if (success) {
        // Retry original request with new token
        const newHeaders = this.getHeaders(true);
        response = await fetch(url, {
          ...config,
          headers: {
            ...newHeaders,
            ...options.headers,
          },
        });
      } else {
        this.logout();
        throw new Error('Session expired. Please log in again.');
      }
    }

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const errorMsg = data && typeof data === 'object' ? data.message || data.error || JSON.stringify(data) : data;
      throw new Error(errorMsg || `API Error: ${response.status} ${response.statusText}`);
    }

    return data;
  }

  private async refreshTokens(): Promise<boolean> {
    const refreshToken = localStorage.getItem('jobflow_refresh_token');
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (res.ok) {
        const payload = await res.json();
        if (payload.success && payload.data) {
          localStorage.setItem('jobflow_token', payload.data.accessToken);
          localStorage.setItem('jobflow_refresh_token', payload.data.refreshToken);
          return true;
        }
      }
    } catch (err) {
      console.error('Failed to rotate refresh token:', err);
    }
    return false;
  }

  public logout() {
    localStorage.removeItem('jobflow_token');
    localStorage.removeItem('jobflow_refresh_token');
    localStorage.removeItem('jobflow_user');
  }

  // --- AUTH ENDPOINTS ---
  
  public async login(payload: any): Promise<any> {
    const res = await this.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, false);
    if (res.success && res.data) {
      localStorage.setItem('jobflow_token', res.data.accessToken);
      localStorage.setItem('jobflow_refresh_token', res.data.refreshToken);
      localStorage.setItem('jobflow_user', JSON.stringify(res.data.user));
    }
    return res;
  }

  public async register(payload: any): Promise<any> {
    const res = await this.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, false);
    if (res.success && res.data) {
      localStorage.setItem('jobflow_token', res.data.accessToken);
      localStorage.setItem('jobflow_refresh_token', res.data.refreshToken);
      localStorage.setItem('jobflow_user', JSON.stringify(res.data.user));
    }
    return res;
  }

  public async getMe(): Promise<any> {
    return this.request('/api/v1/auth/me');
  }

  // --- WORKFLOW ENDPOINTS ---
  
  public async getWorkflows(params: { status?: string; page?: number; limit?: number } = {}): Promise<any> {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    return this.request(`/api/v1/workflows?${query.toString()}`);
  }

  public async getWorkflow(id: string): Promise<any> {
    return this.request(`/api/v1/workflows/${id}`);
  }

  public async createWorkflow(dsl: WorkflowDSL): Promise<any> {
    return this.request('/api/v1/workflows', {
      method: 'POST',
      body: JSON.stringify(dsl),
    });
  }

  public async cancelWorkflow(id: string): Promise<any> {
    return this.request(`/api/v1/workflows/${id}/cancel`, {
      method: 'PATCH',
    });
  }

  public async retryWorkflow(id: string): Promise<any> {
    return this.request(`/api/v1/workflows/${id}/retry`, {
      method: 'POST',
    });
  }

  // --- TEMPLATE ENDPOINTS ---
  
  public async getTemplates(): Promise<any> {
    return this.request('/api/v1/workflows/templates');
  }

  public async createTemplate(name: string, description?: string): Promise<any> {
    return this.request('/api/v1/workflows/templates', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  public async createTemplateVersion(templateId: string, dsl: WorkflowDSL): Promise<any> {
    return this.request(`/api/v1/workflows/templates/${templateId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ dsl }),
    });
  }

  public async runTemplate(templateId: string, version?: number): Promise<any> {
    return this.request(`/api/v1/workflows/templates/${templateId}/run`, {
      method: 'POST',
      body: JSON.stringify({ version }),
    });
  }

  // --- WORKER ENDPOINTS ---
  
  public async getWorkers(): Promise<any> {
    return this.request('/api/v1/workers');
  }

  public async getWorkerMetrics(): Promise<any> {
    return this.request('/api/v1/workers/metrics');
  }

  public async drainWorker(id: string): Promise<any> {
    return this.request(`/api/v1/workers/${id}/drain`, {
      method: 'POST',
    });
  }

  // --- MONITORING ENDPOINTS ---
  
  public async getDashboardStats(): Promise<any> {
    return this.request('/api/v1/monitoring/dashboard');
  }

  public async getQueueStats(): Promise<any> {
    return this.request('/api/v1/monitoring/queues');
  }
}

export const apiService = new ApiService();
