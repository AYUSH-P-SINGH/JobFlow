package com.jobflow.sdk;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * Java client SDK binding for JobFlow API v2.0
 */
public class JobFlowClient {
    private final String baseUrl;
    private final String apiKey;
    private final HttpClient httpClient;

    public JobFlowClient(String baseUrl, String apiKey) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
        this.apiKey = apiKey;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    /**
     * Triggers the execution of a workflow.
     */
    public String triggerWorkflow(String templateId, Map<String, Object> payload) throws Exception {
        String jsonPayload = String.format("{\"payload\": %s}", serializeMap(payload));
        
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "api/v1/workflows/templates/" + templateId + "/run"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 300) {
            throw new RuntimeException("JobFlow API failed with status " + response.statusCode() + ": " + response.body());
        }

        return response.body();
    }

    /**
     * Fetches current execution status for a workflow run.
     */
    public String getWorkflowStatus(String workflowId) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "api/v1/workflows/" + workflowId))
                .header("Authorization", "Bearer " + apiKey)
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 300) {
            throw new RuntimeException("JobFlow API failed with status " + response.statusCode() + ": " + response.body());
        }

        return response.body();
    }

    private String serializeMap(Map<String, Object> map) {
        StringBuilder sb = new StringBuilder("{");
        map.forEach((k, v) -> {
            sb.append("\"").append(k).append("\":");
            if (v instanceof String) {
                sb.append("\"").append(v).append("\",");
            } else {
                sb.append(v).append(",");
            }
        });
        if (sb.length() > 1) {
            sb.setLength(sb.length() - 1);
        }
        sb.append("}");
        return sb.toString();
    }
}
