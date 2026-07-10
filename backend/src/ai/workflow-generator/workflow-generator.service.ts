import { logger } from '../../common/logger/logger.js';

export interface WorkflowGeneratedStep {
  stepId: string;
  name: string;
  jobType: string;
  payload: Record<string, any>;
  dependsOn: string[];
}

export class WorkflowGeneratorService {
  /**
   * Translates a natural language description of a workflow into a structured step list.
   * Leverages external LLM APIs if keys are available, otherwise falls back to a smart local parser.
   */
  public static async generate(prompt: string): Promise<{ steps: WorkflowGeneratedStep[] }> {
    logger.info(`[WorkflowGenerator] Generating workflow structure for prompt: "${prompt}"`);

    const openAiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (openAiKey) {
      try {
        return await this.callOpenAI(prompt, openAiKey);
      } catch (err) {
        logger.error(`OpenAI generation failed: ${(err as Error).message}. Falling back to local parser.`);
      }
    } else if (geminiKey) {
      try {
        return await this.callGemini(prompt, geminiKey);
      } catch (err) {
        logger.error(`Gemini generation failed: ${(err as Error).message}. Falling back to local parser.`);
      }
    }

    // Fallback: Smart local rule-based parsing engine
    return this.localFallbackParse(prompt);
  }

  /**
   * Smart rule-based local parser that tokenizes natural language prompt and resolves workflow steps.
   */
  private static localFallbackParse(prompt: string): { steps: WorkflowGeneratedStep[] } {
    const text = prompt.toLowerCase();
    const steps: WorkflowGeneratedStep[] = [];

    // Simple sentence/clause tokenizer
    const segments = text
      .split(/,|\bthen\b|\band then\b|\bnext\b|\bfollowed by\b|\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let stepIndex = 1;

    for (const segment of segments) {
      let jobType = 'NOTIFICATION'; // Default fallback type
      let payload: Record<string, any> = { message: `Simulated execution of: ${segment}` };
      let name = `Action Step ${stepIndex}`;

      if (segment.includes('email') || segment.includes('mail') || segment.includes('send to')) {
        jobType = 'EMAIL';
        payload = {
          to: 'recipient@enterprise.local',
          subject: 'AI Generated Notification',
          body: `Automatic notification for: ${segment}`,
        };
        name = `Send Email Notification`;
      } else if (segment.includes('report') || segment.includes('compile') || segment.includes('csv') || segment.includes('pdf')) {
        jobType = 'REPORT';
        payload = {
          format: segment.includes('csv') ? 'csv' : 'pdf',
          title: 'Automated AI Generated Report',
        };
        name = `Generate PDF/CSV Report`;
      } else if (segment.includes('image') || segment.includes('resize') || segment.includes('crop') || segment.includes('photo')) {
        jobType = 'IMAGE';
        payload = {
          action: segment.includes('crop') ? 'crop' : 'resize',
          width: 1024,
          height: 768,
        };
        name = `Process Image Asset`;
      } else if (segment.includes('notify') || segment.includes('slack') || segment.includes('alert')) {
        jobType = 'NOTIFICATION';
        payload = {
          message: `Alert: ${segment}`,
        };
        name = `Slack / Push Alert`;
      }

      const stepId = `step-${stepIndex}`;
      const dependsOn: string[] = [];

      // Link linearly by default to form a DAG chain
      if (stepIndex > 1) {
        dependsOn.push(`step-${stepIndex - 1}`);
      }

      steps.push({
        stepId,
        name,
        jobType,
        payload,
        dependsOn,
      });

      stepIndex++;
    }

    if (steps.length === 0) {
      // Return a default simple step if parsing yielded nothing
      steps.push({
        stepId: 'step-1',
        name: 'Default Generated Notification',
        jobType: 'NOTIFICATION',
        payload: { message: 'AI Generator fallback default execution step' },
        dependsOn: [],
      });
    }

    return { steps };
  }

  /**
   * Calls OpenAI Chat Completions API with a system schema constraint.
   */
  private static async callOpenAI(prompt: string, apiKey: string): Promise<{ steps: WorkflowGeneratedStep[] }> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant that converts natural language workflow requirements into a JSON list of steps. 
Available jobTypes are: 'EMAIL', 'REPORT', 'NOTIFICATION', 'IMAGE'.
Format the response exactly as:
{
  "steps": [
    {
      "stepId": "unique-id-1",
      "name": "Human readable name",
      "jobType": "EMAIL | REPORT | NOTIFICATION | IMAGE",
      "payload": { ...appropriate payload properties... },
      "dependsOn": [] // array of stepIds this step depends on
    }
  ]
}`,
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI responded with status ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return JSON.parse(content);
  }

  /**
   * Calls Google Gemini Generative Language API.
   */
  private static async callGemini(prompt: string, apiKey: string): Promise<{ steps: WorkflowGeneratedStep[] }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const systemInstruction = `You convert natural language requirements into structured workflow JSON steps.
Available jobTypes: 'EMAIL', 'REPORT', 'NOTIFICATION', 'IMAGE'.
Response MUST be valid JSON matching structure:
{
  "steps": [
    {
      "stepId": "step-1",
      "name": "Step Name",
      "jobType": "EMAIL | REPORT | NOTIFICATION | IMAGE",
      "payload": {},
      "dependsOn": []
    }
  ]
}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemInstruction}\n\nUser Prompt: ${prompt}` }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini responded with status ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(content);
  }
}
