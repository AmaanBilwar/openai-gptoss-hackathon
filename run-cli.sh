#!/bin/bash

# Kite CLI Runner Script
# This script starts the TypeScript backend and Go CLI

echo "🚀 Starting Kite CLI..."

# Function to cleanup on exit
cleanup() {
    echo "🛑 Shutting down..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if we're in the right directory
if [ ! -f "kite/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Error: Go is not installed. Please install Go 1.21+"
    exit 1
fi

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Error: Bun is not installed. Please install Bun"
    exit 1
fi

echo "📦 Installing dependencies..."

# Install TypeScript dependencies
cd kite
bun install
cd ..

# Install Go dependencies
cd tui
go mod tidy
cd ..

echo "🔧 Starting TypeScript backend..."

# Start the TypeScript backend in the background
cd kite
bun run api:dev &
BACKEND_PID=$!
cd ..

# Wait a moment for the backend to start
sleep 3

# Check if backend is running
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ Error: Backend failed to start. Check the logs above."
    cleanup
fi

echo "✅ Backend is running on http://localhost:3001"
echo "🎨 Starting Go CLI..."

# Start the Go CLI
cd tui
go run main.go
cd ..

# Cleanup when CLI exits
cleanup
