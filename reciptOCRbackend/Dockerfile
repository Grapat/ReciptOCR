# Use a base image with Node + Python
FROM node:18-slim

# Install Python + pip + tesseract-ocr
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend code
COPY . .

# Install Node.js dependencies
RUN npm install

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Optional: explicitly set path to Tesseract if needed in Python
# Example: pytesseract.pytesseract.tesseract_cmd = "/usr/bin/tesseract"

# Expose port (adjust if your server uses a different one)
EXPOSE 5000

# Start your Node.js backend (adjust the filename as needed)
CMD ["npm", "start"]
