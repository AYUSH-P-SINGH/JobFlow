import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Options: Ramp-up from 1 to 50 virtual users over 30s, hold for 1m, and ramp down
export const options = {
  stages: [
    { duration: '15s', target: 20 }, // Ramp up to 20 users
    { duration: '30s', target: 50 }, // Ramp up to 50 users
    { duration: '15s', target: 0 },  // Scale down to 0
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // less than 1% errors
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:5000';

// Global variables to hold authentication tokens
let email = `loadtest_${Math.random()}@example.com`;
let password = 'Password123!';

export function setup() {
  // 1. Register a test user for load testing
  const regUrl = `${BASE_URL}/api/v1/auth/register`;
  const regPayload = JSON.stringify({ email, password });
  const regParams = { headers: { 'Content-Type': 'application/json' } };
  
  const regRes = http.post(regUrl, regPayload, regParams);
  check(regRes, { 'setup registration successful': (r) => r.status === 201 });

  // 2. Login to retrieve tokens
  const loginUrl = `${BASE_URL}/api/v1/auth/login`;
  const loginRes = http.post(loginUrl, regPayload, regParams);
  check(loginRes, { 'setup login successful': (r) => r.status === 200 });

  const token = loginRes.json().data.accessToken;
  return { token };
}

export default function (data) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.token}`,
    },
  };

  // 1. Create a dummy sequential workflow DSL execution
  const workflowPayload = JSON.stringify({
    name: `LoadTest-Workflow-${__VU}-${__ITER}`,
    steps: [
      {
        stepId: 'step-1',
        jobType: 'EMAIL',
        priority: 'MEDIUM',
        payload: { to: 'loadtest@example.com', subject: 'Load test alert' },
        dependsOn: [],
      },
      {
        stepId: 'step-2',
        jobType: 'PDF',
        priority: 'HIGH',
        payload: { template: 'report', data: { value: 42 } },
        dependsOn: ['step-1'],
      },
    ],
  });

  const triggerRes = http.post(`${BASE_URL}/api/v1/workflows`, workflowPayload, params);
  
  const success = check(triggerRes, {
    'workflow trigger status is 201': (r) => r.status === 201,
    'workflow ID present': (r) => r.json().data && r.json().data.id !== undefined,
  });

  if (success) {
    const workflowId = triggerRes.json().data.id;
    
    // Poll the status of this workflow once
    sleep(0.5);
    const pollRes = http.get(`${BASE_URL}/api/v1/workflows/${workflowId}`, params);
    check(pollRes, {
      'workflow poll successful': (r) => r.status === 200,
    });
  }

  sleep(1);
}
