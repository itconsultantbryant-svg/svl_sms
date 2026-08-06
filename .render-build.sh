#!/bin/bash
set -e

echo "==> Building SVL-SMS..."

# Install dependencies
echo "==> Installing dependencies..."
npm ci

# Build TypeScript backend
echo "==> Building backend..."
npm run build:backend

# Build frontend
echo "==> Building frontend..."
npm run build:frontend

echo "==> Build complete!"
