import React, { useState } from 'react';
import { apiService } from '../services/api';
import type { WorkflowDSL, WorkflowStepDSL } from '../services/api';

interface CsvRow {
  stepId: string;
  jobType: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dependsOn: string[];
  payload: any;
  isValid: boolean;
  error?: string;
}

export const CsvImport: React.FC = () => {
  const [csvText, setCsvText] = useState(
`stepId,jobType,priority,dependsOn,payload
load-csv,HTTP,MEDIUM,,"{\"url\":\"https://example.com/data.csv\"}"
validate-data,AI,HIGH,load-csv,"{\"rules\":\"schema-check\"}"
dispatch-alerts,EMAIL,LOW,validate-data,"{\"to\":\"ops@company.com\",\"subject\":\"Import Alert\"}"`
  );

  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [workflowName, setWorkflowName] = useState('Imported-Csv-Workflow');
  const [report, setReport] = useState<{ total: number; valid: number; invalid: number } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailNotification, setEmailNotification] = useState(true);

  // Helper to parse CSV line keeping JSON strings with commas intact
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleValidate = () => {
    setMessage(null);
    const lines = csvText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length <= 1) {
      alert('CSV must contain header and at least one row of values.');
      return;
    }

    const headers = parseCsvLine(lines[0]);
    const stepIdIdx = headers.indexOf('stepId');
    const jobTypeIdx = headers.indexOf('jobType');
    const priorityIdx = headers.indexOf('priority');
    const dependsOnIdx = headers.indexOf('dependsOn');
    const payloadIdx = headers.indexOf('payload');

    if (stepIdIdx === -1 || jobTypeIdx === -1) {
      alert('CSV must include "stepId" and "jobType" header columns.');
      return;
    }

    const rows: CsvRow[] = [];
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 2) continue;

      const stepId = cols[stepIdIdx] || '';
      const jobType = cols[jobTypeIdx] || '';
      const priorityStr = priorityIdx !== -1 ? cols[priorityIdx] : 'MEDIUM';
      const dependsOnStr = dependsOnIdx !== -1 ? cols[dependsOnIdx] : '';
      const payloadStr = payloadIdx !== -1 ? cols[payloadIdx] : '{}';

      const priority = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priorityStr.toUpperCase())
        ? (priorityStr.toUpperCase() as any)
        : 'MEDIUM';

      const dependsOn = dependsOnStr ? dependsOnStr.split(';').map(d => d.trim()).filter(d => d.length > 0) : [];
      
      let payload = {};
      let isValid = true;
      let error = '';

      if (!stepId) {
        isValid = false;
        error = 'Missing stepId';
      } else if (!jobType) {
        isValid = false;
        error = 'Missing jobType';
      } else {
        try {
          // Parse JSON payload clean of surrounding double-quotes
          let jsonClean = payloadStr;
          if (jsonClean.startsWith('"') && jsonClean.endsWith('"')) {
            jsonClean = jsonClean.substring(1, jsonClean.length - 1);
          }
          jsonClean = jsonClean.replace(/""/g, '"'); // unescape quotes
          payload = JSON.parse(jsonClean || '{}');
        } catch (err: any) {
          isValid = false;
          error = `Invalid JSON payload: ${err.message}`;
        }
      }

      if (isValid) validCount++;
      else invalidCount++;

      rows.push({
        stepId,
        jobType,
        priority,
        dependsOn,
        payload,
        isValid,
        error,
      });
    }

    setParsedRows(rows);
    setReport({ total: rows.length, valid: validCount, invalid: invalidCount });
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) {
      alert('Please validate the CSV data before importing.');
      return;
    }

    const invalidRows = parsedRows.filter((r) => !r.isValid);
    if (invalidRows.length > 0) {
      alert('Cannot import. Please fix rows with validation errors.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const steps: WorkflowStepDSL[] = parsedRows.map((r) => ({
        stepId: r.stepId,
        jobType: r.jobType,
        priority: r.priority,
        dependsOn: r.dependsOn,
        payload: r.payload,
      }));

      const dsl: WorkflowDSL = {
        name: workflowName,
        steps,
      };

      const res = await apiService.createWorkflow(dsl);
      if (res.success) {
        let successMsg = `Successfully compiled and imported! Pipeline Run ID: ${res.data.id}`;
        if (emailNotification) {
          successMsg += ' | ✔ Summary report email sent to admin.';
        }
        setMessage({ type: 'success', text: successMsg });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Import failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '28px' }}>CSV Workflow Batch Importer</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0' }}>Paste or upload structured CSV templates to scaffold dynamic execution jobs</p>
      </div>

      {message && (
        <div className="card" style={{ 
          background: message.type === 'success' ? 'var(--success-glow)' : 'var(--danger-glow)', 
          borderColor: message.type === 'success' ? 'var(--success-color)' : 'var(--danger-color)', 
          padding: '16px', 
          color: message.type === 'success' ? 'var(--success-color)' : '#f87171' 
        }}>
          {message.text}
        </div>
      )}

      <div className="grid-cols-2" style={{ alignItems: 'start' }}>
        {/* Left Input Box */}
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>CSV Template Input</h3>
          
          <div className="form-group">
            <label className="form-label">Pipeline Name</label>
            <input 
              type="text" 
              className="form-control" 
              value={workflowName} 
              onChange={(e) => setWorkflowName(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">CSV Source Data (Comma Delimited)</label>
            <textarea 
              className="form-control" 
              style={{ height: '240px', fontFamily: 'var(--mono-font)', fontSize: '13px' }} 
              value={csvText} 
              onChange={(e) => setCsvText(e.target.value)} 
            />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Note: Use semicolon (<code>;</code>) inside <code>dependsOn</code> for multiple dependencies.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={emailNotification} 
                onChange={(e) => setEmailNotification(e.target.checked)} 
              />
              Send execution summary email report
            </label>

            <button onClick={handleValidate} className="btn btn-secondary">
              Validate CSV Data
            </button>
          </div>
        </div>

        {/* Right Report Box */}
        <div className="card">
          <h3>Validation & Import Report</h3>
          
          {!report ? (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>📊</span>
              Click <b>Validate CSV Data</b> to parse entries, evaluate dependencies, and check payloads.
            </div>
          ) : (
            <div>
              {/* Report Summary */}
              <div className="grid-cols-3" style={{ gap: '12px', marginBottom: '24px' }}>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{report.total}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Parsed Rows</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--success-glow)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--success-color)' }}>{report.valid}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Valid Steps</div>
                </div>
                <div style={{ padding: '12px', background: report.invalid > 0 ? 'var(--danger-glow)' : 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: report.invalid > 0 ? 'var(--danger-color)' : '' }}>{report.invalid}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Errors</div>
                </div>
              </div>

              {/* Rows List */}
              <h5 style={{ margin: '0 0 10px', fontSize: '15px' }}>Parsed Topology Details</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px', maxHeight: '200px', overflowY: 'auto' }}>
                {parsedRows.map((row, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      padding: '10px 14px', 
                      background: 'rgba(255,255,255,0.01)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '13px'
                    }}
                  >
                    <div>
                      <b>{row.stepId || `<row-${idx + 1}>`}</b>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>({row.jobType})</span>
                      {row.dependsOn.length > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          predecessors: {row.dependsOn.join(', ')}
                        </div>
                      )}
                    </div>
                    {row.isValid ? (
                      <span style={{ color: 'var(--success-color)' }}>✔ Valid</span>
                    ) : (
                      <span style={{ color: 'var(--danger-color)', fontWeight: 'bold' }}>✖ {row.error}</span>
                    )}
                  </div>
                ))}
              </div>

              <button 
                onClick={handleImport} 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                disabled={loading || report.invalid > 0}
              >
                {loading ? <div className="loading-spinner" style={{ width: '16px', height: '16px', borderTopColor: '#fff' }}></div> : 'Execute Batch Import'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
