import { AuditService } from '../monitoring/audit.service.js';

export class ComplianceService {
  
  public static async logWorkflowStart(
    userId: string,
    workflowId: string,
    name: string
  ): Promise<void> {
    await AuditService.log(userId, 'Workflow Started', 'Workflow', { workflowId, name });
  }
  public static async logWorkflowCancellation(
    userId: string,
    workflowId: string
  ): Promise<void> {
    await AuditService.log(userId, 'Workflow Cancelled', 'Workflow', { workflowId });
  }
  public static async logPolicyDecision(
    userId: string,
    policyId: string,
    rule: string,
    decision: 'PASS' | 'FAIL',
    details: string
  ): Promise<void> {
    await AuditService.log(userId, 'Policy Decision', 'Policy', {
      policyId,
      rule,
      decision,
      details,
    });
  }
  public static async logApiKeyUsage(
    keyId: string,
    tenantId: string,
    path: string,
    method: string
  ): Promise<void> {
    await AuditService.log('api-key-actor', 'API Key Used', 'ApiKey', {
      keyId,
      tenantId,
      path,
      method,
    });
  }
  public static async logConfigChange(
    userId: string,
    action: string,
    resource: string,
    details: any
  ): Promise<void> {
    await AuditService.log(userId, action, resource, details);
  }
}
