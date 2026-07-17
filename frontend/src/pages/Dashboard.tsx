import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { socketService } from '../services/socket';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<any>({
    totalWorkflows: 0,
    activeWorkflows: 0,
    successRate: 100,
    activeWorkers: 0,
  });

  const [queues, setQueues] = useState<any>({
    active: 0,
    waiting: 0,
    completed: 0,
    failed: 0,
  });

  const [workflows, setWorkflows] = useState<any[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch all dashboard data
  const fetchData = async () => {
    try {
      setError(null);
      // Fetch workflows
      const wfRes = await apiService.getWorkflows({ limit: 10 });
      if (wfRes.success && wfRes.data) {
        setWorkflows(wfRes.data.workflows || wfRes.data);
      }

      // Fetch dashboard metrics
      const statsRes = await apiService.getDashboardStats().catch(() => null);
      if (statsRes && statsRes.success) {
        setStats(statsRes.data);
      }

      // Fetch queue stats
      const qRes = await apiService.getQueueStats().catch(() => null);
      if (qRes && qRes.success) {
        setQueues(qRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));

    // Poll stats occasionally as a fallback
    const interval = setInterval(fetchData, 8000);

    // Socket.IO event listeners for real-time updates
    const handleWorkflowStarted = (payload: any) => {
      console.log('Real-time workflow.started:', payload);
      setWorkflows((prev) => [payload.workflow, ...prev.filter((w) => w.id !== payload.workflow.id)].slice(0, 10));
      setStats((prev: any) => ({ ...prev, activeWorkflows: prev.activeWorkflows + 1 }));
    };

    const handleWorkflowUpdated = (payload: any) => {
      console.log('Real-time workflow.updated:', payload);
      setWorkflows((prev) =>
        prev.map((w) => (w.id === payload.workflow.id ? { ...w, ...payload.workflow } : w))
      );
      if (selectedWorkflow && selectedWorkflow.id === payload.workflow.id) {
        setSelectedWorkflow((prev: any) => ({ ...prev, ...payload.workflow }));
      }
    };

    const handleWorkflowCompleted = (payload: any) => {
      console.log('Real-time workflow.completed:', payload);
      setWorkflows((prev) =>
        prev.map((w) => (w.id === payload.workflow.id ? { ...w, ...payload.workflow } : w))
      );
      setStats((prev: any) => ({
        ...prev,
        activeWorkflows: Math.max(0, prev.activeWorkflows - 1),
        totalWorkflows: prev.totalWorkflows + 1,
      }));
      if (selectedWorkflow && selectedWorkflow.id === payload.workflow.id) {
        setSelectedWorkflow((prev: any) => ({ ...prev, ...payload.workflow }));
      }
      fetchData(); // Refresh queue and exact metrics
    };

    const handleWorkflowFailed = (payload: any) => {
      console.log('Real-time workflow.failed:', payload);
      setWorkflows((prev) =>
        prev.map((w) => (w.id === payload.workflow.id ? { ...w, ...payload.workflow } : w))
      );
      setStats((prev: any) => ({
        ...prev,
        activeWorkflows: Math.max(0, prev.activeWorkflows - 1),
      }));
      if (selectedWorkflow && selectedWorkflow.id === payload.workflow.id) {
        setSelectedWorkflow((prev: any) => ({ ...prev, ...payload.workflow }));
      }
      fetchData();
    };

    const handleJobProgress = (payload: any) => {
      console.log('Real-time job.progress:', payload);
      // Trigger detail view update if active
      if (selectedWorkflow) {
        // Find if job belongs to selected workflow and update progress
        const updatedSteps = selectedWorkflow.steps?.map((step: any) => {
          if (step.jobId === payload.jobId) {
            return { ...step, progress: payload.progress, status: 'RUNNING' };
          }
          return step;
        });
        setSelectedWorkflow((prev: any) => prev ? { ...prev, steps: updatedSteps } : null);
      }
    };

    socketService.on('workflow.started', handleWorkflowStarted);
    socketService.on('workflow.updated', handleWorkflowUpdated);
    socketService.on('workflow.completed', handleWorkflowCompleted);
    socketService.on('workflow.failed', handleWorkflowFailed);
    socketService.on('job.progress', handleJobProgress);

    return () => {
      clearInterval(interval);
      socketService.off('workflow.started', handleWorkflowStarted);
      socketService.off('workflow.updated', handleWorkflowUpdated);
      socketService.off('workflow.completed', handleWorkflowCompleted);
      socketService.off('workflow.failed', handleWorkflowFailed);
      socketService.off('job.progress', handleJobProgress);
    };
  }, [selectedWorkflow?.id]);

  const handleSelectWorkflow = async (wf: any) => {
    setSelectedWorkflow(wf);
    socketService.subscribeWorkflow(wf.id);
    try {
      const detailed = await apiService.getWorkflow(wf.id);
      if (detailed.success && detailed.data) {
        setSelectedWorkflow(detailed.data);
      }
    } catch (err) {
      console.error('Failed to fetch detailed workflow logs:', err);
    }
  };

  const handleCancel = async (id: string) => {
    if (window.confirm('Are you sure you want to cancel this workflow execution?')) {
      try {
        await apiService.cancelWorkflow(id);
        fetchData();
        if (selectedWorkflow && selectedWorkflow.id === id) {
          handleSelectWorkflow(selectedWorkflow);
        }
      } catch (err: any) {
        alert(err.message || 'Failed to cancel workflow');
      }
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await apiService.retryWorkflow(id);
      fetchData();
      if (selectedWorkflow && selectedWorkflow.id === id) {
        handleSelectWorkflow(selectedWorkflow);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to retry workflow');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px' }}>Dashboard Overview</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0' }}>Real-time orchestration & workflow pipeline telemetry</p>
        </div>
        <button onClick={fetchData} className="btn btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          Sync Stats
        </button>
      </div>

      {error && (
        <div className="card" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '16px', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid-cols-4">
        <div className="card stat-card">
          <div>
            <div className="stat-title">Total Pipelines</div>
            <div className="stat-num">{stats.totalWorkflows || workflows.length}</div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--accent-glow)', color: 'var(--accent-color)' }}>🗂</div>
        </div>

        <div className="card stat-card">
          <div>
            <div className="stat-title">Active Running</div>
            <div className="stat-num">{stats.activeWorkflows || workflows.filter(w => w.status === 'RUNNING').length}</div>
          </div>
          <div className="stat-icon pulse-glow" style={{ background: 'var(--running-glow)', color: 'var(--running-color)' }}>⚡</div>
        </div>

        <div className="card stat-card">
          <div>
            <div className="stat-title">Success Rate</div>
            <div className="stat-num">{stats.successRate ?? 100}%</div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--success-glow)', color: 'var(--success-color)' }}>✔</div>
        </div>

        <div className="card stat-card">
          <div>
            <div className="stat-title">Active Workers</div>
            <div className="stat-num">{stats.activeWorkers || 0}</div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}>🖥</div>
        </div>
      </div>

      {/* Queue Telemetry Row */}
      <div className="card">
        <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px' }}>Distributed BullMQ Queue Status</h3>
        <div className="grid-cols-4" style={{ gap: '16px' }}>
          <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--warning-color)' }}>{queues.waiting ?? 0}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '4px' }}>Waiting / Delayed</div>
          </div>
          <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--running-color)' }}>{queues.active ?? 0}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '4px' }}>Processing (Active)</div>
          </div>
          <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--success-color)' }}>{queues.completed ?? 0}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '4px' }}>Completed Jobs</div>
          </div>
          <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--danger-color)' }}>{queues.failed ?? 0}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '4px' }}>Failed (Dead Letter)</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Executions + Details */}
      <div className="grid-cols-2" style={{ alignItems: 'start' }}>
        {/* Left Column: Recent Pipelines */}
        <div className="card">
          <h3 style={{ marginBottom: '20px' }}>Recent Pipeline Executions</h3>
          
          {loading && workflows.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="loading-spinner"></div>
            </div>
          ) : workflows.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No workflow executions found. Go to <b>Workflow Builder</b> to launch one.
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Pipeline Name</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workflows.map((wf) => (
                    <tr 
                      key={wf.id} 
                      onClick={() => handleSelectWorkflow(wf)}
                      style={{ cursor: 'pointer', background: selectedWorkflow?.id === wf.id ? 'rgba(255,255,255,0.03)' : '' }}
                    >
                      <td style={{ fontWeight: '500' }}>
                        {wf.name}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          ID: {wf.id.substring(0, 8)}... | {new Date(wf.createdAt).toLocaleTimeString()}
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${wf.status.toLowerCase()}`}>{wf.status}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>{Math.round(wf.progress ?? 0)}%</span>
                          <div className="progress-container" style={{ width: '60px', margin: 0 }}>
                            <div className="progress-bar" style={{ width: `${wf.progress ?? 0}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {wf.status === 'RUNNING' || wf.status === 'PENDING' ? (
                            <button onClick={() => handleCancel(wf.id)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                              Cancel
                            </button>
                          ) : wf.status === 'FAILED' || wf.status === 'CANCELLED' ? (
                            <button onClick={() => handleRetry(wf.id)} className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                              Retry
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>N/A</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Execution Telemetry Details & Events log */}
        <div className="card">
          <h3>Pipeline Execution Details</h3>
          {!selectedWorkflow ? (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>🔍</span>
              Select a pipeline from the list to view live step telemetry, variables, execution time, and audit logs.
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '18px' }}>{selectedWorkflow.name}</h4>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Created: {new Date(selectedWorkflow.createdAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', gap: '6px' }}>
                  <span className={`badge badge-${selectedWorkflow.status.toLowerCase()}`}>{selectedWorkflow.status}</span>
                  {selectedWorkflow.status === 'RUNNING' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--running-color)' }}>
                      <div className="loading-spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }}></div>
                      Processing Steps
                    </div>
                  )}
                </div>
              </div>

              {/* Step list details */}
              <h5 style={{ margin: '0 0 12px', fontSize: '15px' }}>Workflow Step Execution Plan</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {selectedWorkflow.steps?.map((step: any) => (
                  <div 
                    key={step.id} 
                    style={{ 
                      padding: '14px', 
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{step.stepId}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{step.jobType}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Priority: {step.priority} | Depends: {step.dependsOn && step.dependsOn.length > 0 ? step.dependsOn.join(', ') : 'None'}
                      </div>
                    </div>
                    <span className={`badge badge-${(step.status || 'PENDING').toLowerCase()}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                      {step.status || 'PENDING'}
                    </span>
                  </div>
                ))}
              </div>

              {/* History Event Logs Timeline */}
              <h5 style={{ margin: '0 0 12px', fontSize: '15px' }}>Live Audit Timeline Log</h5>
              <div style={{ borderLeft: '2px solid var(--bg-tertiary)', paddingLeft: '16px', marginLeft: '8px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '200px', overflowY: 'auto' }}>
                {(!selectedWorkflow.histories || selectedWorkflow.histories.length === 0) ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No events logs recorded for this execution.
                  </div>
                ) : (
                  selectedWorkflow.histories.map((log: any) => (
                    <div key={log.id} style={{ position: 'relative' }}>
                      <div 
                        style={{ 
                          width: '10px', 
                          height: '10px', 
                          borderRadius: '50%', 
                          background: log.event.includes('fail') ? 'var(--danger-color)' : log.event.includes('complete') ? 'var(--success-color)' : 'var(--accent-color)', 
                          position: 'absolute', 
                          left: '-22px', 
                          top: '4px',
                          border: '2px solid var(--bg-primary)'
                        }}
                      ></div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(log.createdAt).toLocaleTimeString()} — <b>{log.event}</b>
                      </div>
                      <div style={{ fontSize: '13px', color: '#fff', marginTop: '2px' }}>
                        {log.message}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
