# --- Stage 1: Node.js Dependencies Builder ---
# Use a standard slim Node.js base image (e.g., node:20-slim)
FROM node:20-alpine AS node_builder
WORKDIR /app
COPY package*.json ./
RUN npm install --frozen-lockfile

# --- Stage 2: Python and Tesseract OCR Dependencies Builder ---
# Use a standard slim Python base image (e.g., python:3.11-slim)
FROM python:3.11-slim AS python_ocr_builder

# Install system-level dependencies for Tesseract and OpenCV
# libgl1-mesa-glx is often needed for opencv-python in headless environments
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-tha \
    libgl1-mesa-glx \
    # Clean up apt caches to reduce image size
    && rm -rf /var/lib/apt/lists/*

# Copy the Python requirements file
COPY requirements.txt .

# Install Python packages
# --no-cache-dir: Reduces image size by not storing pip's cache
# --break-system-packages: Allows pip to install into the system's site-packages on newer Debian/Ubuntu bases
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# --- Stage 3: Final Combined Runtime Image ---
FROM node:20-alpine AS final
WORKDIR /app
COPY --from=node_builder /app/node_modules ./node_modules
COPY --from=node_builder /app/package*.json ./
RUN ln -sf /usr/bin/python3 /usr/bin/python
COPY --from=python_ocr_builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python_ocr_builder /usr/bin/tesseract /usr/bin/tesseract
COPY --from=python_ocr_builder /usr/share/tesseract-ocr /usr/share/tesseract-ocr
RUN ln -sf /usr/bin/tesseract /usr/local/bin/tesseract

# --- Application Code ---
COPY . .
# Ensure the 'processed_uploads' directory exists, as your server.js serves it
RUN mkdir -p /app/processed_uploads
# Expose the port your Node.js application listens on
EXPOSE 3000
# Command to run your Node.js application when the container starts
CMD ["node", "server.js"]