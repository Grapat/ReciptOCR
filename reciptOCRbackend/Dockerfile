FROM node:18-alpine

# Install Python, pip, Tesseract, Thai language data, and build tools
RUN apk update && apk add --no-cache \
    python3 \
    py3-pip \
    tesseract-ocr \
    tesseract-ocr-data-tha \
    build-base \
    cmake \
    # Clean up apk cache to reduce image size
    && rm -rf /var/cache/apk/*

# Set working directory inside container
WORKDIR /app

# Copy package files and install Node dependencies
COPY package*.json ./
RUN npm install

# Copy Python dependency list and install
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Copy rest of application code
COPY . .

# Set environment variables (optional: better error messages in Node/Flask)
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# Expose port used by the app
EXPOSE 5000

# Start your Node.js server
CMD ["npm", "start"]