### Stage 1: Build React bundle
FROM node:20-alpine AS ui-builder
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

### Stage 2: Build Go binary
FROM golang:1.22-alpine AS go-builder
RUN apk add --no-cache git
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=ui-builder /web/../static ./static
RUN go install github.com/a-h/templ/cmd/templ@latest && \
    templ generate ./templates/... && \
    go build -ldflags="-s -w" -o bin/server ./cmd/server

### Stage 3: Minimal runtime image
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=go-builder /app/bin/server ./server
COPY --from=go-builder /app/static ./static
EXPOSE 8080
ENV SERVER_PORT=8080 DATABASE_PATH=/data/fullerhome.db STATIC_DIR=/app/static
VOLUME ["/data"]
CMD ["./server"]
