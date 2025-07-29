FROM node:20-alpine AS node_builder
WORKDIR /app
COPY package*.json ./
RUN npm install --frozen-lockfile
FROM python:3.11-slim AS python_ocr_builder
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-tha \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# --- Stage 3: Final Combined Runtime Image ---
# Use a standard slim Node.js base image for the final stage.
# These slim images are usually Debian-based and will have Python3 available.
FROM node:20-alpine AS final
WORKDIR /app
COPY --from=node_builder /app/node_modules ./node_modules
COPY --from=node_builder /app/package*.json ./
RUN ln -sf /usr/bin/python3 /usr/bin/python
COPY --from=python_ocr_builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python_ocr_builder /usr/bin/tesseract /usr/bin/tesseract
COPY --from=python_ocr_builder /usr/share/tesseract-ocr /usr/share/tesseract-ocr
RUN ln -sf /usr/bin/tesseract /usr/local/bin/tesseract
COPY . .
RUN mkdir -p /app/processed_uploads
EXPOSE 3000
CMD ["node", "server.js"]