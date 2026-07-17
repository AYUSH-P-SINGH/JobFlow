import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';

export const WorkerRegistry: React.FC = () => {
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getWorkers();
      if (res.success && res.data) {
        setWorkers(res.data.workers || res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch workers registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDrain = async (id: string) => {
    if (window.confirm('Are you sure you want to drain this worker? It will complete currently executing jobs but accept no new ones.')) {
      try {
        await apiService.drainWorker(id);
        fetchWorkers();
      } catch (err: any) {
        alert(err.message || 'Failed to drain worker.');
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'READY': return 'var(--success-color)';
      case 'BUSY': return 'var(--running-color)';
      case 'DRAINING': return 'var(--warning-color)';
      case 'OFFLINE': return 'var(--text-muted)';
      default: return '#fff';
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px' }}>Intelligent Worker Registry</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0' }}>Monitor background node capacity, CPU loads, and active task distributions</p>
        </div>
        <button onClick={fetchWorkers} className="btn btn-secondary" disabled={loading}>
          Sync Registry
        </button>
      </div>

      {error && (
        <div className="card" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '16px', color: '#f87171', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {loading && workers.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="loading-spinner"></div>
        </div>
      ) : workers.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>💤</span>
          No workers registered. Start worker processes (e.g. <code>npm run worker</code> or spin up containers) to see registry nodes.
        </div>
      ) : (
        <div className="grid-cols-2">
          {workers.map((worker) => (
            <div key={worker.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {worker.hostname}
                    <span 
                      style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: getStatusColor(worker.status)
                      }} 
                    />
                  </h4>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    ID: {worker.id} | Region: {worker.region}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', gap: '4px' }}>
                  <span className={`badge badge-${worker.status.toLowerCase()}`}>{worker.status}</span>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Heartbeat: {Math.max(0, Math.round((Date.now() - new Date(worker.lastHeartbeat).getTime()) / 1000))}s ago
                  </div>
                </div>
              </div>

              {/* Resource Loads */}
              <div className="grid-cols-3" style={{ gap: '12px' }}>
                <div style={{ padding: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>CPU Cores</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px' }}>{worker.cpu}</div>
                </div>
                <div style={{ padding: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Memory</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px' }}>{worker.memory} MB</div>
                </div>
                <div style={{ padding: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Load</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px', color: worker.currentLoad > 0.8 ? 'var(--danger-color)' : '' }}>
                    {Math.round(worker.currentLoad * 100)}%
                  </div>
                </div>
              </div>

              {/* Jobs Statistics */}
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Jobs (Active / Max):</span>
                  <b>{worker.runningJobs} / {worker.concurrency}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Completed Tasks:</span>
                  <span style={{ color: 'var(--success-color)' }}>{worker.completedJobs}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Failed Tasks:</span>
                  <span style={{ color: worker.failedJobs > 0 ? 'var(--danger-color)' : '' }}>{worker.failedJobs}</span>
                </div>
              </div>

              {/* Capabilities / Supported types */}
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Supported Job Types</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {worker.supportedJobs && worker.supportedJobs.map((type: string) => (
                    <span 
                      key={type} 
                      style={{ 
                        fontSize: '11px', 
                        background: 'var(--bg-tertiary)', 
                        border: '1px solid var(--border-color)', 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        color: '#fff'
                      }}
                    >
                      {type}
                    </span>
                  ))}
                  {(!worker.supportedJobs || worker.supportedJobs.length === 0) && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Any (General Worker)</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: 'auto', paddingTop: '10px' }}>
                {worker.status !== 'DRAINING' && worker.status !== 'OFFLINE' && (
                  <button onClick={() => handleDrain(worker.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                    📯 Drain Node
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
