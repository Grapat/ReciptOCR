# --- Stage 1: Node.js Dependencies Builder ---
FROM node:20-slim AS node_builder
WORKDIR /app
COPY package*.json ./
RUN npm install --frozen-lockfile

# --- Stage 2: Final Combined Runtime Image ---
FROM node:20-slim AS final
WORKDIR /app

# Install Python3, pip, and Tesseract with size optimizations
# Using 'no-install-recommends' to reduce unnecessary package pulls
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-tha \
    libgl1-mesa-glx \
    # Clean up apt caches and temporary files immediately to reduce layer size
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Copy Node.js modules and package files from the node_builder stage
COPY --from=node_builder /app/node_modules ./node_modules
COPY --from=node_builder /app/package*.json ./

# Install Python requirements using pip
COPY requirements.txt .
# Use --break-system-packages (as discussed) and --no-cache-dir for size
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Create symlinks for python and tesseract for easier execution
RUN ln -sf /usr/bin/python3 /usr/bin/python \
    && ln -sf /usr/bin/tesseract /usr/local/bin/tesseract

# --- Application Code ---
# Copy the rest of your application source code last to leverage build cache
COPY . .

# Ensure the 'processed_uploads' directory exists
RUN mkdir -p /app/processed_uploads

# Expose the port your Node.js application listens on
EXPOSE 3000

# Command to run your Node.js application when the container starts
CMD ["node", "server.js"]