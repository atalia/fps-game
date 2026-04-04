package protocol

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/xeipuuv/gojsonschema"
)

// SchemaLoader 缓存已加载的 schema
var schemaLoader = make(map[string]gojsonschema.JSONLoader)

// getSchemaLoader 获取指定消息类型的 schema loader
func getSchemaLoader(messageType string) (gojsonschema.JSONLoader, error) {
	if loader, ok := schemaLoader[messageType]; ok {
		return loader, nil
	}

	// 查找 schema 文件
	schemaPath := filepath.Join("..", "..", "..", "shared", "schemas", messageType+".json")
	absPath, err := filepath.Abs(schemaPath)
	if err != nil {
		return nil, err
	}

	loader := gojsonschema.NewReferenceLoader("file://" + absPath)
	schemaLoader[messageType] = loader
	return loader, nil
}

// ValidateSchema 验证消息是否符合 schema
func ValidateSchema(t *testing.T, messageType string, msg map[string]interface{}) {
	loader, err := getSchemaLoader(messageType)
	if err != nil {
		t.Fatalf("Failed to load schema for %s: %v", messageType, err)
	}

	msgBytes, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Failed to marshal message: %v", err)
	}

	documentLoader := gojsonschema.NewStringLoader(string(msgBytes))
	result, err := gojsonschema.Validate(loader, documentLoader)
	if err != nil {
		t.Fatalf("Schema validation error: %v", err)
	}

	if !result.Valid() {
		t.Errorf("Schema validation failed for %s:", messageType)
		for _, desc := range result.Errors() {
			t.Errorf("  - %s", desc)
		}
	}
}

// ValidateSchemaStrict 验证消息并返回错误（不使用 testing.T）
func ValidateSchemaStrict(messageType string, msg map[string]interface{}) error {
	loader, err := getSchemaLoader(messageType)
	if err != nil {
		return err
	}

	msgBytes, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	documentLoader := gojsonschema.NewStringLoader(string(msgBytes))
	result, err := gojsonschema.Validate(loader, documentLoader)
	if err != nil {
		return err
	}

	if !result.Valid() {
		return &SchemaValidationError{Errors: result.Errors()}
	}

	return nil
}

// SchemaValidationError schema 验证错误
type SchemaValidationError struct {
	Errors []gojsonschema.ResultError
}

func (e *SchemaValidationError) Error() string {
	return "schema validation failed"
}

// TestSchemaFilesExist 验证所有 schema 文件存在
func TestSchemaFilesExist(t *testing.T) {
	schemas := []string{
		"room_joined",
		"player_joined",
		"player_shot",
		"player_damaged",
		"player_killed",
		"weapon_changed",
		"money_updated",
		"voice_start",
		"voice_data",
	}

	for _, schema := range schemas {
		schemaPath := filepath.Join("..", "..", "..", "shared", "schemas", schema+".json")
		if _, err := os.Stat(schemaPath); os.IsNotExist(err) {
			t.Errorf("Schema file not found: %s", schemaPath)
		}
	}
}
