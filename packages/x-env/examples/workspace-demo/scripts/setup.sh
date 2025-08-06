#!/bin/bash

# Workspace Demo Setup Script
# This script sets up the development environment for the workspace integration example

set -e

echo "🚀 Setting up workspace integration example..."

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm first:"
    echo "   npm install -g pnpm"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Copy environment variable templates if they don't exist
echo "🔧 Setting up environment variables..."

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Created workspace .env file from template"
else
    echo "ℹ️  Workspace .env file already exists"
fi

if [ ! -f "projects/base-service/.env" ]; then
    cp projects/base-service/.env.example projects/base-service/.env
    echo "✅ Created base-service .env file from template"
else
    echo "ℹ️  Base-service .env file already exists"
fi

if [ ! -f "projects/web-app/.env" ]; then
    cp projects/web-app/.env.example projects/web-app/.env
    echo "✅ Created web-app .env file from template"
else
    echo "ℹ️  Web-app .env file already exists"
fi

# Generate TypeScript types
echo "🔨 Generating TypeScript types..."
pnpm run generate-types

# Build all projects
echo "🏗️  Building all projects..."
pnpm run build

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit the .env files to configure your environment variables"
echo "2. Run 'pnpm run start --filter base-service' to start the base service"
echo "3. Run 'pnpm run start --filter web-app' to start the web application"
echo ""
echo "For more information, see the README.md file."
