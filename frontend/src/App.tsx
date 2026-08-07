import { useState, useEffect } from 'react';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { WorkflowBuilder } from './pages/WorkflowBuilder';
import { CsvImport } from './pages/CsvImport';
import { WorkerRegistry } from './pages/WorkerRegistry';
import { apiService } from './services/api';
import { socketService } from './services/socket';
import './index.css';

type Page = 'dashboard' | 'builder' | 'csv' | 'workers';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [user, setUser] = useState<any>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const checkAuth = () => {
    const token = localStorage.getItem('jobflow_token');
    const savedUser = localStorage.getItem('jobflow_user');
    if (token) {
      setIsAuthenticated(true);
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          localStorage.removeItem('jobflow_user');
          setUser(null);
        }
      }
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Set up WebSocket connection when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const token = localStorage.getItem('jobflow_token');
      if (token) {
        socketService.connect(apiService.getBaseUrl(), token);
        setWsConnected(true);
      }
    } else {
      socketService.disconnect();
      setWsConnected(false);
    }
    return () => socketService.disconnect();
  }, [isAuthenticated]);

  const handleLoginSuccess = () => {
    checkAuth();
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    apiService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setWsConnected(false);
  };

  if (!isAuthenticated) {
    if (isRegistering) {
      return (
        <Register 
          onRegisterSuccess={handleLoginSuccess}
          onNavigateToLogin={() => setIsRegistering(false)} 
        />
      );
    }
    return (
      <Login 
        onLoginSuccess={handleLoginSuccess} 
        onNavigateToRegister={() => setIsRegistering(true)}
      />
    );
  }

  const pageTitles: Record<Page, string> = {
    dashboard: 'System Overview & Telemetry',
    builder: 'Visual DAG Workflow Builder',
    csv: 'Bulk CSV Batch Import Engine',
    workers: 'Worker Cluster Topology & Health',
  };

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="brand-title">JobFlow</span>
        </div>
        
        <div className="sidebar-menu">
          <div 
            className={`sidebar-item ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
          >
            <span className="sidebar-item-icon">📊</span>
            <span>Dashboard Overview</span>
          </div>
          
          <div 
            className={`sidebar-item ${currentPage === 'builder' ? 'active' : ''}`}
            onClick={() => setCurrentPage('builder')}
          >
            <span className="sidebar-item-icon">🛠</span>
            <span>Visual DAG Builder</span>
          </div>

          <div 
            className={`sidebar-item ${currentPage === 'csv' ? 'active' : ''}`}
            onClick={() => setCurrentPage('csv')}
          >
            <span className="sidebar-item-icon">📥</span>
            <span>CSV Batch Importer</span>
          </div>

          <div 
            className={`sidebar-item ${currentPage === 'workers' ? 'active' : ''}`}
            onClick={() => setCurrentPage('workers')}
          >
            <span className="sidebar-item-icon">🖥</span>
            <span>Worker Clusters</span>
          </div>

          <div style={{ margin: '16px 0 8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            External Management
          </div>

          <a 
            href={`${apiService.getBaseUrl()}/admin/queues`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="sidebar-item"
          >
            <span className="sidebar-item-icon">⚙</span>
            <span>BullMQ Admin Board ↗</span>
          </a>

          <a 
            href={`${apiService.getBaseUrl()}/docs`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="sidebar-item"
          >
            <span className="sidebar-item-icon">📖</span>
            <span>API Swagger Docs ↗</span>
          </a>
        </div>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '14px' }}>
              {(user?.email?.[0] || 'D').toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.email || 'Developer User'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Enterprise Operator
              </div>
            </div>
          </div>

          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', marginTop: '6px' }}>
            <span>🚪</span> Sign Out
          </button>
        </div>
      </div>

      {/* Main Container Area */}
      <div className="main-container">
        {/* Top Header info bar */}
        <div className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 700 }}>
              {pageTitles[currentPage]}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pulse-dot" style={{ color: wsConnected ? 'var(--emerald-500)' : 'var(--amber-500)' }}></span>
              <span className={`badge ${wsConnected ? 'badge-completed' : 'badge-pending'}`}>
                {wsConnected ? 'LIVE WEBSOCKET CONNECTED' : 'CONNECTING...'}
              </span>
            </div>

            <div style={{ height: '20px', width: '1px', background: 'var(--border-subtle)' }}></div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              API Base: <code style={{ fontSize: '12px', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '6px', color: 'var(--cyan-500)', fontFamily: 'var(--mono-font)' }}>{apiService.getBaseUrl()}</code>
            </div>
          </div>
        </div>

        {/* Page Render */}
        <div className="content-area">
          {currentPage === 'dashboard' && <Dashboard />}
          {currentPage === 'builder' && <WorkflowBuilder />}
          {currentPage === 'csv' && <CsvImport />}
          {currentPage === 'workers' && <WorkerRegistry />}
        </div>
      </div>
    </div>
  );
}

export default App;
