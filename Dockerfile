# Production Container for 24/7 Cozy Beats Cloud Converter
FROM node:20-slim

# Install system dependencies, python3, ffmpeg and latest yt-dlp binary
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    ca-certificates \
    curl && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source
COPY . .

# Build the frontend assets for production
RUN npm run build

# Port configuration (Cloud providers usually assign PORT via environment variable)
ENV PORT=10000
EXPOSE 10000

# Start standalone Node.js production server
CMD ["node", "server/index.js"]
