package main

import (
	"context"
	"fmt"
	"time"

	"github.com/mtfuller/starterpack-go-gin/pkg/httpclient"
	"github.com/mtfuller/starterpack-go-gin/pkg/logger"
)

// Example demonstrating how to use the HTTP client package
func main() {
	// Initialize logger
	log := logger.New("info")

	// Create HTTP client with 10 second timeout
	client := httpclient.New(10*time.Second, log)

	// Example 1: Making a GET request
	fmt.Println("Example 1: GET request")
	ctx := context.Background()
	body, status, err := client.Get(ctx, "https://jsonplaceholder.typicode.com/posts/1", nil)
	if err != nil {
		log.WithField("error", err.Error()).Error("GET request failed")
		return
	}
	fmt.Printf("Status: %d\n", status)
	fmt.Printf("Response: %s\n\n", string(body))

	// Example 2: Making a POST request
	fmt.Println("Example 2: POST request")
	requestBody := map[string]interface{}{
		"title":  "foo",
		"body":   "bar",
		"userId": 1,
	}
	body, status, err = client.Post(ctx, "https://jsonplaceholder.typicode.com/posts", requestBody, nil)
	if err != nil {
		log.WithField("error", err.Error()).Error("POST request failed")
		return
	}
	fmt.Printf("Status: %d\n", status)
	fmt.Printf("Response: %s\n\n", string(body))

	// Example 3: Making a request with custom headers
	fmt.Println("Example 3: GET request with custom headers")
	headers := map[string]string{
		"Authorization": "Bearer your-token-here",
		"X-Custom-Header": "custom-value",
	}
	body, status, err = client.Get(ctx, "https://jsonplaceholder.typicode.com/posts/1", headers)
	if err != nil {
		log.WithField("error", err.Error()).Error("GET request with headers failed")
		return
	}
	fmt.Printf("Status: %d\n", status)
	fmt.Printf("Response: %s\n", string(body))
}
