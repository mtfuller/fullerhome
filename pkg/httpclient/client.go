package httpclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/mtfuller/starterpack-go-gin/pkg/logger"
)

// Client is a wrapper around http.Client with logging
type Client struct {
	httpClient *http.Client
	logger     *logger.Logger
}

// New creates a new HTTP client
func New(timeout time.Duration, log *logger.Logger) *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: timeout,
		},
		logger: log,
	}
}

// Get performs a GET request
func (c *Client) Get(ctx context.Context, url string, headers map[string]string) ([]byte, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create request: %w", err)
	}

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	return c.doRequest(req)
}

// Post performs a POST request with JSON body
func (c *Client) Post(ctx context.Context, url string, body interface{}, headers map[string]string) ([]byte, int, error) {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	return c.doRequest(req)
}

// doRequest executes the HTTP request and logs it
func (c *Client) doRequest(req *http.Request) ([]byte, int, error) {
	start := time.Now()

	c.logger.WithFields(map[string]interface{}{
		"method": req.Method,
		"url":    req.URL.String(),
	}).Debug("Making HTTP request")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		c.logger.WithFields(map[string]interface{}{
			"method":   req.Method,
			"url":      req.URL.String(),
			"error":    err.Error(),
			"duration": time.Since(start).Milliseconds(),
		}).Error("HTTP request failed")
		return nil, 0, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response body: %w", err)
	}

	c.logger.WithFields(map[string]interface{}{
		"method":      req.Method,
		"url":         req.URL.String(),
		"status_code": resp.StatusCode,
		"duration":    time.Since(start).Milliseconds(),
	}).Info("HTTP request completed")

	return body, resp.StatusCode, nil
}
