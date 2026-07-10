package sdk

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// JobFlowClient bindings for JobFlow API v2.0
type JobFlowClient struct {
	BaseURL    string
	APIKey     string
	HTTPClient *http.Client
}

func NewJobFlowClient(baseURL, apiKey string) *JobFlowClient {
	url := baseURL
	if !strings.HasSuffix(url, "/") {
		url += "/"
	}

	return &JobFlowClient{
		BaseURL: url,
		APIKey:  apiKey,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// TriggerWorkflow triggers execution of a workflow template.
func (c *JobFlowClient) TriggerWorkflow(templateID string, payload map[string]interface{}) (string, error) {
	url := fmt.Sprintf("%sapi/v1/workflows/templates/%s/run", c.BaseURL, templateID)
	
	bodyMap := map[string]interface{}{
		"payload": payload,
	}
	jsonBody, err := json.Marshal(bodyMap)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("JobFlow API failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	return string(respBody), nil
}

// GetWorkflowStatus retrieves status of a running/completed workflow instance.
func (c *JobFlowClient) GetWorkflowStatus(workflowID string) (string, error) {
	url := fmt.Sprintf("%sapi/v1/workflows/%s", c.BaseURL, workflowID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+c.APIKey)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("JobFlow API failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	return string(respBody), nil
}
