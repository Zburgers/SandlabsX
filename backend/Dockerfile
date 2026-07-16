FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    bash \
    bridge-utils \
    ca-certificates \
    cpu-checker \
    curl \
    iproute2 \
    iptables \
    procps \
    qemu-system-x86 \
    qemu-utils \
    wget \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund \
  && npm cache clean --force

COPY . .

COPY init-images.sh /usr/local/bin/init-images.sh
COPY setup-network.sh /usr/local/bin/setup-network.sh
RUN chmod +x /usr/local/bin/init-images.sh /usr/local/bin/setup-network.sh \
  && mkdir -p /overlays /images/custom /vms /pids /app/data

ENV NODE_ENV=production
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:3001/api/health || exit 1

CMD ["/bin/bash", "-c", "/usr/local/bin/setup-network.sh && /usr/local/bin/init-images.sh && exec node server.js"]
