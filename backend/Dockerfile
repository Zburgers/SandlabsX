FROM node:18-bullseye-slim

WORKDIR /app

# Install QEMU and required tools (Debian apt packages are more reliable here)
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    qemu-system-x86 \
    qemu-utils \
    bridge-utils \
    iproute2 \
    iptables \
    procps \
    curl \
    wget \
    ca-certificates \
    cpu-checker \
    bash \
  && rm -rf /var/lib/apt/lists/*


# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Copy initialization scripts
COPY init-images.sh /usr/local/bin/init-images.sh
COPY setup-network.sh /usr/local/bin/setup-network.sh
RUN chmod +x /usr/local/bin/init-images.sh
RUN chmod +x /usr/local/bin/setup-network.sh

# Create directories
RUN mkdir -p /overlays /images /app/data

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start with network setup, then image initialization, then server
CMD ["/bin/bash", "-c", "/usr/local/bin/setup-network.sh && /usr/local/bin/init-images.sh && node server.js"]
