# Stage 1: Build the Vite React Frontend
# Set the working directory to the 'frontend' subdirectory
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY ./frontend/package*.json ./
RUN npm install --frozen-lockfile
COPY ./frontend .
RUN npm run build

# Stage 2: Build the Final Backend & Serve Stage
FROM node:20-slim AS final
WORKDIR /app

# Install Node.js dependencies
COPY --from=frontend-builder /app/frontend/node_modules ./node_modules
COPY --from=frontend-builder /app/frontend/package*.json ./

# Install Python and Tesseract along with their dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-tha \
    libgl1-mesa-glx && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Install Python requirements
COPY ./backend/requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Create symbolic links for Python and Tesseract
RUN ln -sf /usr/bin/python3 /usr/bin/python && \
    ln -sf /usr/bin/tesseract /usr/local/bin/tesseract

# Copy the built frontend files
# The path is now from '/app/frontend/dist'
COPY --from=frontend-builder /app/frontend/dist /app/public

# Copy the rest of the backend application code
COPY ./backend .

# Ensure the 'processed_uploads' directory exists
RUN mkdir -p /app/processed_uploads

# Expose the port used by the Node.js backend
EXPOSE 3000

# Set the command to start the Node.js application
CMD ["node", "server.js"]