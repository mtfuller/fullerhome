package unit

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mtfuller/starterpack-go-gin/pkg/httpclient"
	"github.com/mtfuller/starterpack-go-gin/pkg/logger"
	"github.com/stretchr/testify/assert"
)

func TestHTTPClientGet(t *testing.T) {
	// Create a test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodGet, r.Method)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"message":"success"}`))
	}))
	defer server.Close()

	// Create client
	var buf bytes.Buffer
	log := logger.NewWithWriter("info", &buf)
	client := httpclient.New(5*time.Second, log)

	// Make request
	body, status, err := client.Get(context.Background(), server.URL, nil)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, status)
	assert.Contains(t, string(body), "success")
}

func TestHTTPClientPost(t *testing.T) {
	// Create a test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"id":1}`))
	}))
	defer server.Close()

	// Create client
	var buf bytes.Buffer
	log := logger.NewWithWriter("info", &buf)
	client := httpclient.New(5*time.Second, log)

	// Make request
	requestBody := map[string]string{"name": "test"}
	body, status, err := client.Post(context.Background(), server.URL, requestBody, nil)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusCreated, status)
	assert.Contains(t, string(body), "id")
}

func TestHTTPClientWithHeaders(t *testing.T) {
	// Create a test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer token123", r.Header.Get("Authorization"))
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Create client
	var buf bytes.Buffer
	log := logger.NewWithWriter("info", &buf)
	client := httpclient.New(5*time.Second, log)

	// Make request with headers
	headers := map[string]string{
		"Authorization": "Bearer token123",
	}
	_, status, err := client.Get(context.Background(), server.URL, headers)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, status)
}
