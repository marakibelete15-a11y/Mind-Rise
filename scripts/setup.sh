#!/usr/bin/env bash
set -e

echo "=================================================="
echo "      MindRise Monorepo Setup & Doctor            "
echo "=================================================="

# Check Node version
NODE_VERSION=$(node -v)
echo "🔍 Detected Node.js version: $NODE_VERSION"

# Setup environment files if missing
if [ ! -f .env ]; then
  echo "📋 Copying root .env.example -> .env"
  cp .env.example .env
fi

if [ ! -f server/.env ]; then
  echo "📋 Copying server/.env.example -> server/.env"
  cp server/.env.example server/.env
fi

echo "📦 Installing monorepo dependencies across workspaces..."
npm install

echo "🛠️ Validating TypeScript type checking..."
npm run typecheck --if-present

echo ""
echo "✅ MindRise setup complete!"
echo "   Run 'npm run dev' to launch both Client and Server."
echo "=================================================="
