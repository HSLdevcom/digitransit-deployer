#!/bin/bash
set -e

# Build image
echo "Testing build"
docker build .

echo Build completed
