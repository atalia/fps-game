package main

import (
	"encoding/json"
	"net/http"
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

func TestWithStaticAssetHeaders_DisablesCachingForStaticAssets(t *testing.T) {
	originalVersion := buildVersion
	originalCommit := buildCommit
	buildVersion = "v9.9.9"
	buildCommit = "deadbee"
	defer func() {
		buildVersion = originalVersion
		buildCommit = originalCommit
	}()

	handler := withStaticAssetHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/js/main.js?v=old", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if got := w.Header().Get("Cache-Control"); got != "no-store, no-cache, must-revalidate" {
		t.Fatalf("Cache-Control = %q", got)
	}
	if got := w.Header().Get("X-Build-Commit"); got != "deadbee" {
		t.Fatalf("X-Build-Commit = %q", got)
	}
	if got := w.Header().Get("X-Build-Version"); got != "v9.9.9+deadbee" {
		t.Fatalf("X-Build-Version = %q", got)
	}
}
