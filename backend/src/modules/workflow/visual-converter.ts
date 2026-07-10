export interface VisualNode {
  id: string;
  type?: string;
  data?: {
    name?: string;
    jobType?: string;
    payload?: Record<string, any>;
    [key: string]: any;
  };
}

export interface VisualEdge {
  source: string;
  target: string;
}

export interface VisualWorkflowInput {
  nodes: VisualNode[];
  edges: VisualEdge[];
}

export interface DAGStep {
  stepId: string;
  name: string;
  jobType: string;
  payload: Record<string, any>;
  dependsOn: string[];
}

export class VisualWorkflowConverter {
  /**
   * Translates visual nodes and edges representation into structured linear DAG steps.
   */
  public static toDAGSteps(input: VisualWorkflowInput): DAGStep[] {
    const { nodes, edges } = input;

    if (!nodes || !Array.isArray(nodes)) {
      return [];
    }

    const stepsMap = new Map<string, DAGStep>();

    // 1. Process all nodes
    for (const node of nodes) {
      const stepId = node.id;
      const name = node.data?.name || `Step ${stepId}`;
      const jobType = (node.type || node.data?.jobType || 'NOTIFICATION').toUpperCase();
      const payload = node.data?.payload || node.data || {};

      stepsMap.set(stepId, {
        stepId,
        name,
        jobType,
        payload,
        dependsOn: [],
      });
    }

    // 2. Process all edges to establish dependencies
    if (edges && Array.isArray(edges)) {
      for (const edge of edges) {
        const targetStep = stepsMap.get(edge.target);
        if (targetStep) {
          // target depends on source
          if (!targetStep.dependsOn.includes(edge.source)) {
            targetStep.dependsOn.push(edge.source);
          }
        }
      }
    }

    return Array.from(stepsMap.values());
  }

  /**
   * Translates DAG steps back into visual nodes and edges representation.
   */
  public static toVisualRepresentation(steps: DAGStep[]): VisualWorkflowInput {
    const nodes: VisualNode[] = [];
    const edges: VisualEdge[] = [];

    for (const step of steps) {
      nodes.push({
        id: step.stepId,
        type: step.jobType,
        data: {
          name: step.name,
          payload: step.payload,
        },
      });

      for (const parent of step.dependsOn) {
        edges.push({
          source: parent,
          target: step.stepId,
        });
      }
    }

    return { nodes, edges };
  }
}
