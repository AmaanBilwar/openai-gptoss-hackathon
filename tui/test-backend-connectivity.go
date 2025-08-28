package main

import (
	"fmt"
	"log"
)

func testBackendConnectivity() {
	fmt.Println("Testing Backend Connectivity...")

	// Test backend client initialization
	backend, err := NewBackendClient()
	if err != nil {
		log.Printf("Failed to initialize backend client: %v", err)
		return
	}
	fmt.Println("✅ Backend client initialized successfully")

	// Test tool execution
	fmt.Println("Testing tool execution...")
	result, err := backend.ExecuteTool("check_branch_exists", map[string]interface{}{
		"repo":   "AmaanBilwar/openai-gptoss-hackathon",
		"branch": "main",
	})

	if err != nil {
		log.Printf("Failed to execute tool: %v", err)
		return
	}

	fmt.Printf("✅ Tool execution successful: %+v\n", result)
}
