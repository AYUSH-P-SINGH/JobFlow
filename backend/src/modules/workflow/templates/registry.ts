import { JobPriority } from '../workflow.types.js';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: {
    stepId: string;
    jobType: string;
    priority?: JobPriority;
    payload: Record<string, any>;
    dependsOn: string[];
  }[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'email-campaign',
    name: 'Email Campaign',
    description: 'Send marketing emails and post progress notifications.',
    steps: [
      {
        stepId: 'send-email',
        jobType: 'EMAIL',
        priority: JobPriority.HIGH,
        payload: {
          to: 'subscribers@example.com',
          subject: 'Weekly Newsletter',
          body: 'Check out our latest updates!',
        },
        dependsOn: [],
      },
      {
        stepId: 'notify-slack',
        jobType: 'NOTIFICATION',
        priority: JobPriority.MEDIUM,
        payload: {
          recipientId: 'marketing-team',
          message: 'Newsletter email campaign was sent successfully.',
        },
        dependsOn: ['send-email'],
      },
    ],
  },
  {
    id: 'csv-import',
    name: 'CSV Import Pipeline',
    description: 'Upload a CSV, validate records, import to DB, and send a completion report.',
    steps: [
      {
        stepId: 'upload-csv',
        jobType: 'IMAGE', // Using IMAGE handler
        priority: JobPriority.MEDIUM,
        payload: {
          imageUrl: 'https://storage.jobflow.com/raw/user_import.jpg',
          operation: 'grayscale',
        },
        dependsOn: [],
      },
      {
        stepId: 'validate-records',
        jobType: 'REPORT', // Using REPORT handler
        priority: JobPriority.MEDIUM,
        payload: {
          reportType: 'csv-validation',
          format: 'csv',
        },
        dependsOn: ['upload-csv'],
      },
      {
        stepId: 'db-import',
        jobType: 'NOTIFICATION',
        priority: JobPriority.HIGH,
        payload: {
          recipientId: 'sys-ops',
          message: 'CSV import: validation passed, writing records to postgres...',
        },
        dependsOn: ['validate-records'],
      },
      {
        stepId: 'send-report-email',
        jobType: 'EMAIL',
        priority: JobPriority.LOW,
        payload: {
          to: 'admin@example.com',
          subject: 'CSV Import Completed',
          body: 'Your CSV file has been processed successfully.',
        },
        dependsOn: ['db-import'],
      },
    ],
  },
  {
    id: 'image-pipeline',
    name: 'Image Processing Pipeline',
    description: 'Process an image in parallel (Resize, Optimize, Compress) and package results.',
    steps: [
      {
        stepId: 'fetch-source',
        jobType: 'IMAGE',
        priority: JobPriority.HIGH,
        payload: { imageUrl: 'https://storage.jobflow.com/raw/raw-image.jpg', operation: 'rotate' },
        dependsOn: [],
      },
      {
        stepId: 'resize-small',
        jobType: 'IMAGE',
        priority: JobPriority.MEDIUM,
        payload: { imageUrl: 'https://storage.jobflow.com/raw/raw-image.jpg', operation: 'resize' },
        dependsOn: ['fetch-source'],
      },
      {
        stepId: 'resize-medium',
        jobType: 'IMAGE',
        priority: JobPriority.MEDIUM,
        payload: { imageUrl: 'https://storage.jobflow.com/raw/raw-image.jpg', operation: 'resize' },
        dependsOn: ['fetch-source'],
      },
      {
        stepId: 'resize-large',
        jobType: 'IMAGE',
        priority: JobPriority.MEDIUM,
        payload: { imageUrl: 'https://storage.jobflow.com/raw/raw-image.jpg', operation: 'resize' },
        dependsOn: ['fetch-source'],
      },
      {
        stepId: 'zip-assets',
        jobType: 'REPORT',
        priority: JobPriority.LOW,
        payload: { reportType: 'image-archive-stats', format: 'zip' as any }, // zip is fine for test
        dependsOn: ['resize-small', 'resize-medium', 'resize-large'],
      },
    ],
  },
  {
    id: 'report-generation',
    name: 'Monthly Report Generation',
    description: 'Compile monthly execution statistics and email results to key stakeholders.',
    steps: [
      {
        stepId: 'fetch-stats',
        jobType: 'REPORT',
        priority: JobPriority.MEDIUM,
        payload: { reportType: 'monthly-stats', format: 'csv' },
        dependsOn: [],
      },
      {
        stepId: 'generate-pdf',
        jobType: 'REPORT',
        priority: JobPriority.HIGH,
        payload: { reportType: 'executive-summary', format: 'pdf' },
        dependsOn: ['fetch-stats'],
      },
      {
        stepId: 'email-stakeholders',
        jobType: 'EMAIL',
        priority: JobPriority.HIGH,
        payload: {
          to: 'board@example.com',
          subject: 'Monthly Performance Report',
          body: 'Please find attached the performance statistics for this month.',
        },
        dependsOn: ['generate-pdf'],
      },
    ],
  },
];

export function getTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}
