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

  const checkAuth = () => {
    const token = localStorage.getItem('jobflow_token');
    const savedUser = localStorage.getItem('jobflow_user');
    if (token) {
      setIsAuthenticated(true);
      if (savedUser) {
        setUser(JSON.parse(savedUser));
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
      }
    } else {
      socketService.disconnect();
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

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="sidebar-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          JobFlow Dashboard
        </div>
        
        <div className="sidebar-menu">
          <div 
            className={`sidebar-item ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
          >
            <span>📊</span> Dashboard Overview
          </div>
          
          <div 
            className={`sidebar-item ${currentPage === 'builder' ? 'active' : ''}`}
            onClick={() => setCurrentPage('builder')}
          >
            <span>🛠</span> Visual DAG Builder
          </div>

          <div 
            className={`sidebar-item ${currentPage === 'csv' ? 'active' : ''}`}
            onClick={() => setCurrentPage('csv')}
          >
            <span>📥</span> CSV Batch Importer
          </div>

          <div 
            className={`sidebar-item ${currentPage === 'workers' ? 'active' : ''}`}
            onClick={() => setCurrentPage('workers')}
          >
            <span>🖥</span> Worker Clusters
          </div>

          <a 
            href={`${apiService.getBaseUrl()}/admin/queues`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="sidebar-item"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span>⚙</span> BullMQ Admin Board ↗
          </a>

          <a 
            href={`${apiService.getBaseUrl()}/docs`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="sidebar-item"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span>📖</span> Interactive API Swagger ↗
          </a>
        </div>

        <div className="sidebar-footer">
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Logged in as:<br/>
            <b style={{ color: '#fff' }}>{user?.email || 'Developer'}</b>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Container Area */}
      <div className="main-container">
        {/* Top Header info bar */}
        <div className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Status:</span>
            <span className="badge badge-completed" style={{ fontSize: '11px', padding: '2px 8px' }}>
              SYSTEM OPERATIONAL
            </span>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            API Host: <code style={{ fontSize: '12px', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>{apiService.getBaseUrl()}</code>
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
