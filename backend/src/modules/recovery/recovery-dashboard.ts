import { Request, Response } from 'express';

export class RecoveryDashboard {
  /**
   * Serves a premium operational dashboard UI for Dead Letter Queues and Workflow Recovery.
   */
  public static serve(req: Request, res: Response): void {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JobFlow Admin - Recovery & Reliability Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0a0b10;
      --panel-bg: rgba(18, 20, 32, 0.7);
      --border-glow: rgba(99, 102, 241, 0.15);
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --card-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-dark);
      background-image: 
        radial-gradient(at 10% 20%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
        radial-gradient(at 90% 80%, rgba(16, 185, 129, 0.1) 0px, transparent 50%);
      background-attachment: fixed;
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      padding: 2rem;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 1.5rem;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, var(--primary), var(--success));
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.25rem;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
    }

    .title-area h1 {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 600;
      font-size: 2rem;
      letter-spacing: -0.5px;
      background: linear-gradient(to right, #ffffff, #c7d2fe);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .title-area p {
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-top: 0.25rem;
    }

    .refresh-btn {
      background: linear-gradient(135deg, var(--primary), var(--primary-hover));
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.2);
    }

    .refresh-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
    }

    /* Grid Layout */
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2rem;
      margin-bottom: 2rem;
    }

    @media (min-width: 1024px) {
      .grid {
        grid-template-columns: 2fr 1fr;
      }
    }

    /* Card Panels */
    .panel {
      background: var(--panel-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border-glow);
      border-radius: 20px;
      box-shadow: var(--card-shadow);
      padding: 1.75rem;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 1rem;
    }

    .panel-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.25rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .panel-badge {
      background: rgba(99, 102, 241, 0.15);
      color: var(--primary);
      padding: 0.25rem 0.75rem;
      border-radius: 99px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    /* Table styles */
    .table-container {
      overflow-x: auto;
      width: 100%;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.85rem;
      text-transform: uppercase;
      padding: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    td {
      padding: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      font-size: 0.9rem;
      vertical-align: middle;
    }

    tr:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    /* Status indicators */
    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .status-badge.failed {
      background: rgba(239, 68, 68, 0.15);
      color: var(--danger);
    }

    .status-badge.replayed {
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
    }

    .status-badge.discarded {
      background: rgba(156, 163, 175, 0.15);
      color: var(--text-muted);
    }

    /* Actions */
    .btn-action {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-right: 0.25rem;
    }

    .btn-action:hover {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
    }

    .btn-action.discard:hover {
      background: var(--danger);
      border-color: var(--danger);
    }

    /* Logs & activity cards */
    .log-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 1rem;
      border-left: 3px solid var(--primary);
      background: rgba(255, 255, 255, 0.02);
      border-radius: 0 10px 10px 0;
      margin-bottom: 0.75rem;
    }

    .log-item.reset {
      border-left-color: var(--warning);
    }

    .log-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .log-action {
      font-weight: 600;
      color: var(--text);
    }

    .log-details {
      font-size: 0.85rem;
    }

    .empty-state {
      padding: 3rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.95rem;
    }

    /* Preformatted code block */
    pre {
      background: #020205;
      padding: 0.5rem;
      border-radius: 6px;
      font-family: monospace;
      font-size: 0.75rem;
      max-width: 250px;
      overflow-x: auto;
      color: var(--warning);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo-area">
        <div class="logo-container">
          <div class="logo-icon">JF</div>
          <div class="title-area">
            <h1>JobFlow Governance & Operations</h1>
            <p>Reliability Dashboard & Dead Letter Queue Manager</p>
          </div>
        </div>
      </div>
      <div>
        <button class="refresh-btn" onclick="fetchStats()">
          <svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24">
            <path d="M19 12a7 7 0 0 1-7 7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7c1.86 0 3.53.73 4.78 1.91L15 9h7V2l-2.42 2.42C18.13 2.94 15.17 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10h-2z"/>
          </svg>
          Refresh Status
        </button>
      </div>
    </header>

    <div class="grid">
      <!-- DLQ Panel -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <svg style="width:20px;height:20px;fill:var(--danger)" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            Dead Letter Queue (DLQ)
          </div>
          <span id="dlq-count" class="panel-badge">0 failed</span>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Queue</th>
                <th>Retries</th>
                <th>Failure Description</th>
                <th>Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="dlq-tbody">
              <tr>
                <td colspan="7" class="empty-state">Loading DLQ status...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Recovery Logs Panel -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <svg style="width:20px;height:20px;fill:var(--success)" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            Recovery History Log
          </div>
          <span id="log-count" class="panel-badge">0 events</span>
        </div>
        <div id="logs-container" style="flex:1; overflow-y:auto; max-height: 500px;">
          <div class="empty-state">No recovery events recorded.</div>
        </div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr;">
      <!-- Active Checkpoints -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <svg style="width:20px;height:20px;fill:var(--warning)" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Active Workflow Checkpoints
          </div>
          <span id="checkpoint-count" class="panel-badge">0 active</span>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Workflow ID</th>
                <th>Step ID</th>
                <th>Step Number</th>
                <th>Status</th>
                <th>Saved Time</th>
                <th>Stored State</th>
              </tr>
            </thead>
            <tbody id="checkpoints-tbody">
              <tr>
                <td colspan="6" class="empty-state">No checkpoints saved.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Prompt credentials if API token is missing, or read from localStorage
    let token = localStorage.getItem('admin_token');
    
    if (!token) {
      // Basic login flow prompt to retrieve the admin token
      const email = prompt('Enter Admin Email:', 'admin@jobflow.com');
      const password = prompt('Enter Admin Password:', 'admin123');
      
      if (email && password) {
        fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data.accessToken) {
            token = data.data.accessToken;
            localStorage.setItem('admin_token', token);
            fetchStats();
          } else {
            alert('Authentication failed.');
          }
        })
        .catch(err => {
          alert('Authentication error: ' + err.message);
        });
      }
    } else {
      fetchStats();
    }

    async function fetchStats() {
      if (!token) return;

      try {
        const res = await fetch('/api/v1/admin/recovery/dashboard', {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });

        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('admin_token');
          alert('Token expired or unauthorized. Please refresh the page.');
          window.location.reload();
          return;
        }

        const payload = await res.json();
        if (payload.success) {
          renderDashboard(payload.data);
        }
      } catch (err) {
        console.error('Error fetching dashboard statistics:', err);
      }
    }

    function renderDashboard(data) {
      // 1. DLQ Jobs
      const dlqTbody = document.getElementById('dlq-tbody');
      const dlqCount = document.getElementById('dlq-count');
      dlqCount.innerText = data.dlqJobs.length + ' total';

      if (data.dlqJobs.length === 0) {
        dlqTbody.innerHTML = '<tr><td colspan="7" class="empty-state">No failed jobs in DLQ. Everything is running healthy!</td></tr>';
      } else {
        dlqTbody.innerHTML = data.dlqJobs.map(job => {
          const isFailed = job.status === 'FAILED';
          const actionButtons = isFailed ? \`
            <button class="btn-action" onclick="replayJob('\${job.jobId}')">Replay</button>
            <button class="btn-action discard" onclick="discardJob('\${job.jobId}')">Discard</button>
          \` : '<span style="color:var(--text-muted)">Done</span>';

          return \`
            <tr>
              <td>\${job.jobId.slice(0,8)}...</td>
              <td>\${job.queueName}</td>
              <td>\${job.attemptsMade}</td>
              <td><pre>\${JSON.stringify(job.error, null, 2)}</pre></td>
              <td>\${new Date(job.failedAt).toLocaleTimeString()}</td>
              <td><span class="status-badge \${job.status.toLowerCase()}">\${job.status}</span></td>
              <td>\${actionButtons}</td>
            </tr>
          \`;
        }).join('');
      }

      // 2. Recovery Logs
      const logsContainer = document.getElementById('logs-container');
      const logCount = document.getElementById('log-count');
      logCount.innerText = data.recoveryLogs.length + ' logs';

      if (data.recoveryLogs.length === 0) {
        logsContainer.innerHTML = '<div class="empty-state">No recovery events recorded.</div>';
      } else {
        logsContainer.innerHTML = data.recoveryLogs.map(log => \`
          <div class="log-item \${log.action.toLowerCase()}">
            <div class="log-header">
              <span class="log-action">\${log.action}</span>
              <span>\${new Date(log.createdAt).toLocaleTimeString()}</span>
            </div>
            <div class="log-details">Workflow ID: \${log.workflowId.slice(0, 8)}...</div>
            <div class="log-details" style="color:var(--text-muted)">\${log.details || ''}</div>
          </div>
        \`).join('');
      }

      // 3. Active Checkpoints
      const cpTbody = document.getElementById('checkpoints-tbody');
      const cpCount = document.getElementById('checkpoint-count');
      cpCount.innerText = data.checkpoints.length + ' saved';

      if (data.checkpoints.length === 0) {
        cpTbody.innerHTML = '<tr><td colspan="6" class="empty-state">No execution checkpoints currently saved in the DB.</td></tr>';
      } else {
        cpTbody.innerHTML = data.checkpoints.map(cp => \`
          <tr>
            <td>\${cp.workflowId.slice(0, 8)}...</td>
            <td>\${cp.stepId}</td>
            <td>#\${cp.stepNumber}</td>
            <td><span class="status-badge replayed" style="background:rgba(99,102,241,0.15)">\${cp.status}</span></td>
            <td>\${new Date(cp.updatedAt).toLocaleTimeString()}</td>
            <td><pre style="color:var(--success)">\&lcub;"result":\${JSON.stringify(cp.result)}\&rcub;</pre></td>
          </tr>
        \`).join('');
      }
    }

    async function replayJob(jobId) {
      if (!confirm('Are you sure you want to replay failed Job ' + jobId + '?')) return;
      try {
        const res = await fetch(\`/api/v1/admin/recovery/dlq/\${jobId}/replay\`, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        if (data.success) {
          alert('Job re-enqueued for execution!');
          fetchStats();
        } else {
          alert('Failed to replay job: ' + data.error);
        }
      } catch (err) {
        alert('Error replaying job: ' + err.message);
      }
    }

    async function discardJob(jobId) {
      if (!confirm('Are you sure you want to permanently discard failed Job ' + jobId + '?')) return;
      try {
        const res = await fetch(\`/api/v1/admin/recovery/dlq/\${jobId}/discard\`, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        if (data.success) {
          alert('Job discarded from DLQ.');
          fetchStats();
        } else {
          alert('Failed to discard job: ' + data.error);
        }
      } catch (err) {
        alert('Error discarding job: ' + err.message);
      }
    }
  </script>
</body>
</html>
`);
  }
}
