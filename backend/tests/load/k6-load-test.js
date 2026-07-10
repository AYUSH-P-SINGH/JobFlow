import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Options for Load Testing: 100 concurrent users (VUs)
export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp-up to 50 users
    { duration: '1m', target: 100 },  // Ramp-up and sustain at 100 concurrent users
    { duration: '30s', target: 100 }, // Peak load sustain
    { duration: '30s', target: 0 },   // Cool-down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests must complete under 200ms (API Latency SLO)
    http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
  },
};

const BASE_URL = 'http://localhost:5000';

// Mock setup to register/login and retrieve the token
export function setup() {
  const loginUrl = `${BASE_URL}/api/v1/auth/login`;
  const payload = JSON.stringify({
    email: 'admin@jobflow.com',
    password: 'admin123',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(loginUrl, payload, params);
  const token = response.json('data.accessToken');
  return { token };
}

export default function (data) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.token}`,
    },
  };

  // 1. Create a job (simulates queuing jobs)
  const jobPayload = JSON.stringify({
    title: 'Load Test Email Job',
    description: 'Enqueuing email under high concurrency load test',
    type: 'EMAIL',
    priority: 'HIGH',
    payload: { to: 'loadtest@enterprise.com', subject: 'Load Test Run', body: 'Concurrently enqueuing jobs' },
  });

  const jobRes = http.post(`${BASE_URL}/api/v1/jobs`, jobPayload, params);
  check(jobRes, {
    'job creation status is 201': (r) => r.status === 201,
    'job contains ID': (r) => r.json('data.id') !== undefined,
  });

  sleep(0.5); // Simulate think time

  // 2. Fetch jobs list (simulates active query usage)
  const listRes = http.get(`${BASE_URL}/api/v1/jobs?limit=5`, params);
  check(listRes, {
    'jobs query status is 200': (r) => r.status === 200,
  });

  sleep(1); // Simulate think time
}
