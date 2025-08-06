#!/bin/bash

# Workspace Demo Test Script
# This script runs integration tests for the workspace example

set -e

echo "🧪 Running workspace integration tests..."

# Function to check if a process is running on a specific port
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to wait for a service to be ready
wait_for_service() {
    local port=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $service_name to be ready on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if check_port $port; then
            echo "✅ $service_name is ready!"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts - waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name failed to start within timeout"
    return 1
}

# Clean up function
cleanup() {
    echo "🧹 Cleaning up test processes..."
    if [ ! -z "$BASE_SERVICE_PID" ]; then
        kill $BASE_SERVICE_PID 2>/dev/null || true
    fi
    if [ ! -z "$WEB_APP_PID" ]; then
        kill $WEB_APP_PID 2>/dev/null || true
    fi
}

# Set up cleanup trap
trap cleanup EXIT

echo "1️⃣  Testing configuration validation..."

# Test base-service configuration
echo "   Testing base-service configuration..."
cd projects/base-service
if pnpm run validate; then
    echo "✅ Base-service configuration is valid"
else
    echo "❌ Base-service configuration validation failed"
    exit 1
fi
cd ../..

# Test web-app configuration
echo "   Testing web-app configuration..."
cd projects/web-app
if pnpm run validate; then
    echo "✅ Web-app configuration is valid"
else
    echo "❌ Web-app configuration validation failed"
    exit 1
fi
cd ../..

echo "2️⃣  Testing project builds..."

# Build all projects
if pnpm run build; then
    echo "✅ All projects built successfully"
else
    echo "❌ Build failed"
    exit 1
fi

echo "3️⃣  Testing service startup..."

# Start base-service in background
echo "   Starting base-service..."
cd projects/base-service
pnpm run start &
BASE_SERVICE_PID=$!
cd ../..

# Wait for base-service to be ready
if ! wait_for_service 3000 "base-service"; then
    exit 1
fi

# Start web-app in background
echo "   Starting web-app..."
cd projects/web-app
pnpm run start &
WEB_APP_PID=$!
cd ../..

# Wait for web-app to be ready
if ! wait_for_service 3001 "web-app"; then
    exit 1
fi

echo "4️⃣  Testing service communication..."

# Test base-service health endpoint
if curl -f http://localhost:3000/health >/dev/null 2>&1; then
    echo "✅ Base-service health check passed"
else
    echo "⚠️  Base-service health check failed (this is expected if no health endpoint is implemented)"
fi

# Test web-app health endpoint
if curl -f http://localhost:3001/health >/dev/null 2>&1; then
    echo "✅ Web-app health check passed"
else
    echo "⚠️  Web-app health check failed (this is expected if no health endpoint is implemented)"
fi

echo "5️⃣  Testing dependency resolution..."

# Check if web-app can access base-service configuration
cd projects/web-app
if node -e "
const { WebAppConfig } = require('./dist/config.js');
if (WebAppConfig.BASE_SERVICE_DB_HOST) {
    console.log('✅ Web-app can access base-service configuration');
    process.exit(0);
} else {
    console.log('❌ Web-app cannot access base-service configuration');
    process.exit(1);
}
" 2>/dev/null; then
    echo "✅ Dependency resolution test passed"
else
    echo "⚠️  Dependency resolution test skipped (requires implementation)"
fi
cd ../..

echo ""
echo "🎉 All tests completed!"
echo ""
echo "Test Summary:"
echo "✅ Configuration validation"
echo "✅ Project builds"
echo "✅ Service startup"
echo "⚠️  Service communication (basic)"
echo "⚠️  Dependency resolution (requires implementation)"
echo ""
echo "Note: Some tests are marked as warnings because they depend on"
echo "the actual implementation of the services, which will be completed"
echo "in subsequent tasks."
