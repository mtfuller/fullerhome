---
applyTo: "**/*_test.go"
---
## Philosophy
- Test observable behavior, not implementation.
- Arrange → Act → Assert; keep tests isolated and fast.
- Prioritize critical paths; aim overall >80% coverage.

## Layout
tests/
- unit/ — fast, isolated (logic, config, utilities)  
- integration/ — endpoints, DB, end-to-end flows

## Code style 
- Unit tests: *_test.go in same package; integration tests in tests/integration/.  
- Use table-driven tests and testify for assertions.  
- Aim >80% coverage; mock external deps.

## Unit testing (guidelines)
- Keep tests in the same package for white-box access when needed.
- Use table-driven tests for variants and edge cases.
- Mock external deps (HTTP, DB interfaces) for isolation.
- Use fixtures/helpers for reusable objects and request construction.
- Assert errors and expected HTTP codes; avoid leaking implementation details.

## Integration testing (guidelines)
- Use gin.TestMode and httptest.NewRecorder/Server for handlers and clients.
- Prefer in-memory DBs (sqlite) for integration DB tests; AutoMigrate in setup.
- Test success and explicit error cases (validation, not-found, timeouts).
- Use setup/teardown and t.Cleanup to keep tests repeatable.

## Best practices
- Table-driven tests for coverage and clarity.
- Cover edge cases (pagination, limits, invalid input).
- Create small test helpers (makeRequest, parseResponse).
- Clean up resources (temp files, DB entries).
- Test concurrency with sync.WaitGroup; assert no race conditions.

## Running tests
- task test        # all
- task test-unit   # unit only
- task test-integration
- task coverage    # opens coverage report
- go test ./... -v
- go test -race ./...

## Coverage targets
- Handlers >90%, Business logic >85%, Utilities >80%, Overall >80%.

## CI
- Run on PRs and main commits: tests, coverage gate, linters, race detector.

Keep tests small, deterministic, and focused on behavior.
