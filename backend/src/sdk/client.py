import urllib.request
import urllib.error
import json

class JobFlowClient:
    """
    Python client SDK for JobFlow Orchestration Platform API v2.0
    """
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/') + '/'
        self.api_key = api_key

    def trigger_workflow(self, template_id: str, payload: dict) -> dict:
        """
        Triggers execution of a workflow template.
        """
        url = f"{self.base_url}api/v1/workflows/templates/{template_id}/run"
        data = json.dumps({"payload": payload}).encode("utf-8")
        
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            raise RuntimeError(f"JobFlow API failed with status {e.code}: {error_body}") from e

    def get_workflow_status(self, workflow_id: str) -> dict:
        """
        Retrieves status of a running/completed workflow instance.
        """
        url = f"{self.base_url}api/v1/workflows/{workflow_id}"
        
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {self.api_key}"
            },
            method="GET"
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            raise RuntimeError(f"JobFlow API failed with status {e.code}: {error_body}") from e
