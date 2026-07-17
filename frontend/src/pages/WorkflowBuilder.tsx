import React, { useState, useRef, useEffect } from 'react';
import { apiService } from '../services/api';
import type { WorkflowDSL, WorkflowStepDSL } from '../services/api';

interface BuilderNode extends WorkflowStepDSL {
  x: number;
  y: number;
}

export const WorkflowBuilder: React.FC = () => {
  const [nodes, setNodes] = useState<BuilderNode[]>([
    {
      stepId: 'fetch-data',
      jobType: 'HTTP',
      priority: 'MEDIUM',
      payload: { url: 'https://api.example.com/data' },
      dependsOn: [],
      x: 50,
      y: 180,
    },
    {
      stepId: 'render-pdf',
      jobType: 'PDF',
      priority: 'HIGH',
      payload: { template: 'invoice' },
      dependsOn: ['fetch-data'],
      x: 320,
      y: 100,
    },
    {
      stepId: 'send-email',
      jobType: 'EMAIL',
      priority: 'MEDIUM',
      payload: { to: 'billing@example.com' },
      dependsOn: ['render-pdf'],
      x: 580,
      y: 180,
    },
  ]);

  const [workflowName, setWorkflowName] = useState('My-Visual-Workflow');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Handle Dragging
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    const node = nodes.find((n) => n.stepId === nodeId);
    if (!node) return;

    e.preventDefault();
    setDraggingNodeId(nodeId);
    setSelectedNodeId(nodeId);

    // Calculate click offset relative to node origin
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (canvasRect) {
      const clickX = e.clientX - canvasRect.left;
      const clickY = e.clientY - canvasRect.top;
      setDragOffset({
        x: clickX - node.x,
        y: clickY - node.y,
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId) return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (canvasRect) {
      const mouseX = e.clientX - canvasRect.left;
      const mouseY = e.clientY - canvasRect.top;

      setNodes((prev) =>
        prev.map((n) => {
          if (n.stepId === draggingNodeId) {
            // Constraint check to stay inside canvas bounds
            const x = Math.max(10, Math.min(canvasRect.width - 210, mouseX - dragOffset.x));
            const y = Math.max(10, Math.min(canvasRect.height - 110, mouseY - dragOffset.y));
            return { ...n, x, y };
          }
          return n;
        })
      );
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setDraggingNodeId(null);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Builder Methods
  const addNode = () => {
    const newId = `step-${nodes.length + 1}`;
    const newNode: BuilderNode = {
      stepId: newId,
      jobType: 'EMAIL',
      priority: 'MEDIUM',
      payload: {},
      dependsOn: [],
      x: 50,
      y: 50 + (nodes.length % 4) * 80,
    };
    setNodes([...nodes, newNode]);
    setSelectedNodeId(newId);
  };

  const deleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.stepId !== nodeId).map((n) => ({
      ...n,
      dependsOn: n.dependsOn.filter((dep) => dep !== nodeId),
    })));
    setSelectedNodeId(null);
  };

  const updateNodeField = (nodeId: string, field: keyof BuilderNode, value: any) => {
    setNodes((prev) =>
      prev.map((n) => (n.stepId === nodeId ? { ...n, [field]: value } : n))
    );
  };

  const updateNodePayload = (nodeId: string, key: string, value: any) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.stepId === nodeId) {
          const payload = { ...n.payload, [key]: value };
          return { ...n, payload };
        }
        return n;
      })
    );
  };

  const toggleDependency = (nodeId: string, depId: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.stepId === nodeId) {
          const dependsOn = n.dependsOn.includes(depId)
            ? n.dependsOn.filter((d) => d !== depId)
            : [...n.dependsOn, depId];
          return { ...n, dependsOn };
        }
        return n;
      })
    );
  };

  // Launch Workflow
  const handleDeployAndRun = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const steps = nodes.map(({ x, y, ...cleanStep }) => cleanStep);
      const dsl: WorkflowDSL = {
        name: workflowName,
        steps,
      };

      const res = await apiService.createWorkflow(dsl);
      if (res.success) {
        setMessage({ type: 'success', text: `Workflow triggered! Run ID: ${res.data.id}` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to trigger workflow.' });
    } finally {
      setLoading(false);
    }
  };

  const selectedNode = nodes.find((n) => n.stepId === selectedNodeId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px' }}>Visual DAG Workflow Builder</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0' }}>Design sequential and parallel task topologies dynamically</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={addNode} className="btn btn-secondary">
            <span>+</span> Add Step Node
          </button>
          <button onClick={handleDeployAndRun} className="btn btn-primary" disabled={loading}>
            {loading ? <div className="loading-spinner" style={{ width: '16px', height: '16px', borderTopColor: '#fff' }}></div> : 'Deploy & Run Pipeline'}
          </button>
        </div>
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

      {/* Name Input */}
      <div className="card" style={{ padding: '16px 24px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Pipeline ID / Name</label>
        <input 
          type="text" 
          className="form-control" 
          style={{ width: '300px' }} 
          value={workflowName} 
          onChange={(e) => setWorkflowName(e.target.value)} 
        />
      </div>

      <div className="builder-workspace">
        {/* Visual Drag/Drop Canvas */}
        <div 
          ref={canvasRef}
          className="builder-canvas"
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          style={{ height: '550px', userSelect: 'none' }}
        >
          {/* Dynamic SVG Connections Overlay */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
              </marker>
            </defs>
            {nodes.map((node) => {
              return node.dependsOn.map((depId) => {
                const parent = nodes.find((n) => n.stepId === depId);
                if (!parent) return null;

                // Connection points
                const fromX = parent.x + 200; // Output is right edge
                const fromY = parent.y + 40;
                const toX = node.x;          // Input is left edge
                const toY = node.y + 40;

                // Bezier curve
                const dx = Math.abs(toX - fromX) * 0.5;
                const controlX1 = fromX + dx;
                const controlY1 = fromY;
                const controlX2 = toX - dx;
                const controlY2 = toY;

                return (
                  <path 
                    key={`${depId}-${node.stepId}`}
                    d={`M ${fromX} ${fromY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${toX} ${toY}`}
                    stroke="var(--accent-color)"
                    strokeWidth="2.5"
                    fill="none"
                    markerEnd="url(#arrow)"
                    opacity="0.8"
                  />
                );
              });
            })}
          </svg>

          {/* Node Components */}
          {nodes.map((node) => (
            <div 
              key={node.stepId}
              className="canvas-node"
              style={{ 
                left: `${node.x}px`, 
                top: `${node.y}px`,
                borderColor: selectedNodeId === node.stepId ? 'var(--accent-color)' : 'var(--border-color)',
                background: selectedNodeId === node.stepId ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node.stepId)}
            >
              <div className="canvas-node-header">
                <span style={{ color: '#fff' }}>{node.stepId}</span>
                <span style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={(e) => { e.stopPropagation(); deleteNode(node.stepId); }}>✕</span>
              </div>
              <div className="canvas-node-type">{node.jobType}</div>
              
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Priority: <b>{node.priority}</b>
              </div>
            </div>
          ))}
        </div>

        {/* Right Details Config Sidebar */}
        <div className="builder-toolbox" style={{ width: '320px' }}>
          <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', margin: 0 }}>Step Configuration</h3>
          
          {!selectedNode ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>
              Click a step node on the canvas to configure variables, job type, priorities, and dependency rules.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label">Step Identifier (ID)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={selectedNode.stepId} 
                  onChange={(e) => updateNodeField(selectedNode.stepId, 'stepId', e.target.value)} 
                />
              </div>

              <div>
                <label className="form-label">Job Type Handler</label>
                <select 
                  className="form-control"
                  value={selectedNode.jobType}
                  onChange={(e) => updateNodeField(selectedNode.stepId, 'jobType', e.target.value)}
                >
                  <option value="EMAIL">EMAIL</option>
                  <option value="PDF">PDF</option>
                  <option value="AI">AI</option>
                  <option value="HTTP">HTTP</option>
                  <option value="SHELL">SHELL</option>
                  <option value="WEBHOOK">WEBHOOK</option>
                </select>
              </div>

              <div>
                <label className="form-label">Job Priority</label>
                <select 
                  className="form-control"
                  value={selectedNode.priority}
                  onChange={(e) => updateNodeField(selectedNode.stepId, 'priority', e.target.value)}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              {/* Payload Options */}
              <div>
                <label className="form-label">Payload Variables (Key-Value)</label>
                {selectedNode.jobType === 'EMAIL' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="to" 
                      value={selectedNode.payload.to || ''} 
                      onChange={(e) => updateNodePayload(selectedNode.stepId, 'to', e.target.value)}
                    />
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="subject" 
                      value={selectedNode.payload.subject || ''} 
                      onChange={(e) => updateNodePayload(selectedNode.stepId, 'subject', e.target.value)}
                    />
                  </div>
                )}
                {selectedNode.jobType === 'PDF' && (
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="template" 
                    value={selectedNode.payload.template || ''} 
                    onChange={(e) => updateNodePayload(selectedNode.stepId, 'template', e.target.value)}
                  />
                )}
                {selectedNode.jobType === 'HTTP' && (
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="URL endpoint" 
                    value={selectedNode.payload.url || ''} 
                    onChange={(e) => updateNodePayload(selectedNode.stepId, 'url', e.target.value)}
                  />
                )}
                {selectedNode.jobType !== 'EMAIL' && selectedNode.jobType !== 'PDF' && selectedNode.jobType !== 'HTTP' && (
                  <textarea 
                    className="form-control" 
                    placeholder='JSON format, e.g. {"args": []}' 
                    value={JSON.stringify(selectedNode.payload)} 
                    onChange={(e) => {
                      try {
                        updateNodeField(selectedNode.stepId, 'payload', JSON.parse(e.target.value));
                      } catch {}
                    }}
                  />
                )}
              </div>

              {/* Dependencies Checklist */}
              <div>
                <label className="form-label">Depends On (Predecessors)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                  {nodes
                    .filter((n) => n.stepId !== selectedNode.stepId)
                    .map((n) => (
                      <label key={n.stepId} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedNode.dependsOn.includes(n.stepId)} 
                          onChange={() => toggleDependency(selectedNode.stepId, n.stepId)}
                        />
                        {n.stepId}
                      </label>
                    ))}
                  {nodes.length <= 1 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No other steps to depend on.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
