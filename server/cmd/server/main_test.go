package main

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func TestHealthHandler_ReturnsBuildVersion(t *testing.T) {
	originalVersion := buildVersion
	originalCommit := buildCommit
	buildVersion = "v1.2.3"
	buildCommit = "abc1234"
	defer func() {
		buildVersion = originalVersion
		buildCommit = originalCommit
	}()

	req := httptest.NewRequest("GET", "/api/health", nil)
	w := httptest.NewRecorder()

	healthHandler(w, req)

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if got := resp["version"]; got != "v1.2.3+abc1234" {
		t.Fatalf("version = %v, want %q", got, "v1.2.3+abc1234")
	}
	if got := resp["commit"]; got != "abc1234" {
		t.Fatalf("commit = %v, want %q", got, "abc1234")
	}
}
