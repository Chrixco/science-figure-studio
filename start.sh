#!/bin/bash

# Circle Network - Quick Start Script
# Usage: ./start.sh [dev|prod]

set -e

MODE=${1:-prod}

echo "🔵 Circle Network - Urban Planning Visualization"
echo "================================================"

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if [ "$MODE" = "dev" ]; then
    echo "🔧 Starting in DEVELOPMENT mode with hot reload..."
    docker-compose --profile dev up dev --build
else
    echo "🚀 Starting in PRODUCTION mode..."
    docker-compose up --build -d
    echo ""
    echo "✅ Circle Network is running!"
    echo "   Open: http://localhost:3000"
    echo ""
    echo "   To stop: docker-compose down"
    echo "   To view logs: docker-compose logs -f"
fi
