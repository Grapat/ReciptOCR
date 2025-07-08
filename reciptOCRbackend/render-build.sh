#!/usr/bin/env bash

# Install system dependencies
apt-get update && apt-get install -y tesseract-ocr

# Install Python dependencies (if needed)
pip install -r requirements.txt

# Install Node.js dependencies
npm install
