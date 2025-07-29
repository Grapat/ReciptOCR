# --- Stage 1: Node.js Dependencies Builder ---
FROM node:20-slim AS node_builder
WORKDIR /app
COPY package*.json ./
RUN npm install --frozen-lockfile

# --- Stage 2: Final Combined Runtime Image (installs all needed components directly) ---
FROM node:20-slim AS final
WORKDIR /app

# Install Python3, pip, and Tesseract directly in this stage
# This ensures all system libraries and binaries are correctly managed by apt-get within node:20-slim
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-tha \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Copy Node.js modules and package files from the node_builder stage
COPY --from=node_builder /app/node_modules ./node_modules
COPY --from=node_builder /app/package*.json ./

# Install Python requirements using pip (now correctly installed and managed by apt)
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt # <-- Use --break-system-packages

# Create symlinks (these should now work correctly as python3 and tesseract are installed by apt)
RUN ln -sf /usr/bin/python3 /usr/bin/python \
    && ln -sf /usr/bin/tesseract /usr/local/bin/tesseract

# --- Application Code ---
COPY . .

# Ensure the 'processed_uploads' directory exists
RUN mkdir -p /app/processed_uploads

# Expose the port your Node.js application listens on
EXPOSE 3000

# Command to run your Node.js application when the container starts
CMD ["node", "server.js"]