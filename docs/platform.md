# JobFlow Developer Platform Guide (v2.0)

Welcome to the JobFlow Developer Platform. Version 2.0 transforms JobFlow from a standalone orchestrator into a cloud-native workflow platform. Developers can build custom integrations using our Multi-Language SDKs, write extensible Plugins, query the real-time GraphQL API, and route secure requests through the centralized API Gateway.

---

## 🔌 API Gateway Middleware & Rates
The API Gateway interceptor sits at the top level of the API stack:
- **Trace Propagation:** Automatically injects and propagates an `X-Correlation-ID` header for all requests to ensure SRE request tracing across services.
- **Centralized Rate Limiting:** Enforces a default limit of `100 requests per 10 seconds` per tenant to protect internal scheduler queues.

---

## 🌐 GraphQL API Queries
JobFlow supports coexisting REST and GraphQL endpoints. Access the GraphQL API via `POST /graphql` with the following structures:

### Fetching Workflow Execution Progress
```graphql
query {
  workflow(id: "uuid-identifier-here") {
    id
    name
    status
    progress
    steps {
      stepId
      status
      progress
    }
  }
}
```

---

## 🛠️ Plugin SDK & Marketplace
Instead of writing native workers, developers can subclass `JobFlowPlugin` and upload their plugins to the JobFlow Marketplace.

### Creating a Custom Plugin
```typescript
import { JobFlowPlugin, IPluginMetadata } from './plugins/plugin-sdk';

export class SlackNotificationPlugin extends JobFlowPlugin {
  readonly metadata: IPluginMetadata = {
    id: 'slack-notify',
    name: 'Slack Notification',
    version: '1.0.0',
    description: 'Post custom alerts to Slack channels.',
    author: 'Ecosystem Dev Team'
  };

  validate(payload: any) {
    if (!payload.channel || !payload.text) {
      throw new Error("Missing 'channel' or 'text' inside payload.");
    }
  }

  async execute(payload: any, progress: (pct: number) => Promise<void>) {
    await progress(50);
    // Execute post request to slack webhook...
    await progress(100);
    return { status: "sent", channel: payload.channel };
  }
}
```

### Marketplace API Endpoints
- `GET /api/v1/marketplace/plugins`: Lists all active marketplace plugins.
- `POST /api/v1/marketplace/plugins`: Registers a custom plugin payload dynamically.
- `GET /api/v1/marketplace/templates`: Lists reusable workflow templates.

---

## 📦 Multi-Language Client SDKs

### 1. Python SDK Client
```python
from jobflow.sdk import JobFlowClient

client = JobFlowClient(base_url="https://jobflow.enterprise.local", api_key="jf_secret_key")

# Trigger execution of a workflow template
response = client.trigger_workflow("template-id-uuid", {
    "file_path": "/uploads/data.csv",
    "notify_recipient": "ops@enterprise.local"
})

print(f"Triggered workflow instance: {response['data']['id']}")
```

### 2. Go SDK Client
```go
package main

import (
	"fmt"
	"github.com/jobflow/jobflow-go/sdk"
)

func main() {
	client := sdk.NewJobFlowClient("https://jobflow.enterprise.local", "jf_secret_key")
	
	payload := map[string]interface{}{
		"format": "pdf",
	}
	res, err := client.TriggerWorkflow("template-id-uuid", payload)
	if err != nil {
		panic(err)
	}
	fmt.Println("Result:", res)
}
```

### 3. Java SDK Client
```java
import com.jobflow.sdk.JobFlowClient;
import java.util.Map;

public class Main {
    public static void main(String[] args) throws Exception {
        JobFlowClient client = new JobFlowClient("https://jobflow.enterprise.local", "jf_secret_key");
        
        String response = client.triggerWorkflow("template-id-uuid", Map.of("email", "ops@enterprise.local"));
        System.out.println("Triggered: " + response);
    }
}
```
