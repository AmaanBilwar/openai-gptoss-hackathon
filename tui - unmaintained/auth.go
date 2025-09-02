package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"time"
)

// AuthClient handles authentication for the Go CLI
type AuthClient struct {
	baseURL string
	client  *http.Client
}

// NewAuthClient creates a new authentication client
func NewAuthClient() *AuthClient {
	baseURL := os.Getenv("BACKEND_URL")
	if baseURL == "" {
		baseURL = "http://localhost:3001"
	}

	return &AuthClient{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// CheckAuthStatus checks if the user is authenticated
func (ac *AuthClient) CheckAuthStatus() (bool, error) {
	resp, err := ac.client.Get(ac.baseURL + "/auth/status")
	if err != nil {
		return false, fmt.Errorf("failed to check auth status: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("auth status check failed with status %d", resp.StatusCode)
	}

	var result struct {
		Authenticated bool `json:"authenticated"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("failed to decode auth status response: %w", err)
	}

	return result.Authenticated, nil
}

// StartAuthFlow starts the browser-based authentication flow
func (ac *AuthClient) StartAuthFlow() error {
	// Open browser to the authentication URL
	authURL := "http://localhost:3000?from_cli=true"

	fmt.Println("🔐 Starting authentication flow...")
	fmt.Printf("🌐 Opening browser to: %s\n", authURL)
	fmt.Println("📝 Please complete the authentication in your browser")
	fmt.Println("⏳ Waiting for authentication to complete...")

	// Open browser
	if err := openBrowser(authURL); err != nil {
		fmt.Printf("⚠️  Failed to open browser automatically: %v\n", err)
		fmt.Printf("🔗 Please manually open: %s\n", authURL)
	}

	// Poll for authentication completion
	return ac.waitForAuth()
}

// waitForAuth polls the auth status until the user is authenticated
func (ac *AuthClient) waitForAuth() error {
	maxAttempts := 60 // 5 minutes with 5-second intervals
	attempts := 0

	for attempts < maxAttempts {
		authenticated, err := ac.CheckAuthStatus()
		if err != nil {
			fmt.Printf("⚠️  Auth check failed: %v\n", err)
		} else if authenticated {
			fmt.Println("✅ Authentication successful!")
			return nil
		}

		attempts++
		time.Sleep(5 * time.Second)

		if attempts%12 == 0 { // Every minute
			fmt.Println("⏳ Still waiting for authentication...")
		}
	}

	return fmt.Errorf("authentication timeout - please try again")
}

// openBrowser opens the default browser to the given URL
func openBrowser(url string) error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default: // linux, freebsd, openbsd, netbsd
		cmd = exec.Command("xdg-open", url)
	}

	return cmd.Start()
}

// RequireAuth ensures the user is authenticated, starting auth flow if needed
func (ac *AuthClient) RequireAuth() error {
	authenticated, err := ac.CheckAuthStatus()
	if err != nil {
		return fmt.Errorf("failed to check authentication status: %w", err)
	}

	if !authenticated {
		fmt.Println("❌ Not authenticated. Starting authentication flow...")
		return ac.StartAuthFlow()
	}

	return nil
}
