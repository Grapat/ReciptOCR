#!/usr/bin/env bash

# Exit on error
set -e

# 1. Install Tesseract (including Thai language data)
apt-get update && apt-get install -y \
  tesseract-ocr \
  tesseract-ocr-tha

# 2. Install Python dependencies
pip install --no-cache-dir -r requirements.txt

# 3. Install Node.js dependencies
npm install
