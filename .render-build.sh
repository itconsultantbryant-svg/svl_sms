#!/bin/bash
set -e

echo "==> Building SVL-SMS..."

# Install dependencies (include build tools even when NODE_ENV=production)
echo "==> Installing dependencies..."
npm install --include=dev

# Build TypeScript backend
echo "==> Building backend..."
npm run build:backend

# Build frontend
echo "==> Building frontend..."
npm run build:frontend

echo "==> Build complete!"
