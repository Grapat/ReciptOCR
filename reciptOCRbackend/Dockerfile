# Start from your existing Node.js base image
FROM node:24-slim

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if you have one)
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# --- ADD THESE LINES TO INSTALL TESSERACT OCR ENGINE AND LANGUAGE PACKS ---
# Install Python, pip, and Tesseract OCR engine
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-tha \
    # Clean up apt caches to reduce image size
    && rm -rf /var/lib/apt/lists/*

# Install Python packages required for OCR (e.g., pytesseract, opencv-python-headless, Pillow)
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt
# -------------------------------------------------------------------------

# Copy the rest of your application code
COPY . .

# Expose the port your app listens on
EXPOSE 3000

# Command to run your Node.js application
CMD ["npm", "start"]