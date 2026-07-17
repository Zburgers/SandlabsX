# syntax=docker/dockerfile:1.7
FROM node:20-bookworm-slim

WORKDIR /app

# LEGACY PACKAGING BOUNDARY
# QEMU and iproute2 still live in the API image because the pre-Capsule runtime
# launches VMs in this container. Move them into the dedicated runner image when
# LocalRunner execution is implemented; the API image should then become a much
# smaller unprivileged Node.js image.
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    cpu-checker \
    curl \
    iproute2 \
    qemu-system-x86 \
    qemu-utils \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm install --omit=dev --no-audit --no-fund \
  && npm cache clean --force

COPY . .

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY init-images.sh /usr/local/bin/init-images.sh
COPY setup-network.sh /usr/local/bin/setup-network.sh
COPY qemu-ifup /usr/local/libexec/sandlabx/qemu-ifup
COPY qemu-ifdown /usr/local/libexec/sandlabx/qemu-ifdown

RUN chmod 0755 \
      /usr/local/bin/docker-entrypoint.sh \
      /usr/local/bin/init-images.sh \
      /usr/local/bin/setup-network.sh \
      /usr/local/libexec/sandlabx/qemu-ifup \
      /usr/local/libexec/sandlabx/qemu-ifdown \
  && mkdir -p /overlays /images/custom /vms /pids /checkpoints /app/data

ENV NODE_ENV=production
EXPOSE 3001
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:3001/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
