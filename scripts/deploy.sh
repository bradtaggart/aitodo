#!/usr/bin/env bash
set -euo pipefail

DOCKERHUB_IMAGE="bradtaggart/aitodo"
REMOTE_HOST="lab-services"
REMOTE_DIR="~/aitodo"
SSH_OPTS="-o StrictHostKeyChecking=accept-new"

# Load APP_VERSION from .env
if [[ -f .env ]]; then
  APP_VERSION=$(grep '^APP_VERSION=' .env | cut -d= -f2)
fi
APP_VERSION=${APP_VERSION:-latest}

echo "==> Deploying aitodo v${APP_VERSION}"

# 1. Build and push to DockerHub
echo "==> Building Docker image..."
docker build -t "${DOCKERHUB_IMAGE}:${APP_VERSION}" -t "${DOCKERHUB_IMAGE}:latest" .

echo "==> Pushing to DockerHub..."
docker push "${DOCKERHUB_IMAGE}:${APP_VERSION}"
docker push "${DOCKERHUB_IMAGE}:latest"

# 2. Generate a modified compose file that uses the DockerHub image
COMPOSE_TMP=$(mktemp /tmp/docker-compose-deploy.XXXXXX.yml)
trap 'rm -f "$COMPOSE_TMP"' EXIT

sed \
  -e '/^\s*build:/d' \
  -e "s|image: aitodo:\${APP_VERSION:-latest}|image: ${DOCKERHUB_IMAGE}:\${APP_VERSION:-latest}|" \
  -e 's/aitodo-dev/aitodo/' \
  docker-compose.yml > "$COMPOSE_TMP"

# 3. Copy compose file and tailscale config to lab-services
echo "==> Copying files to ${REMOTE_HOST}:${REMOTE_DIR}..."
ssh $SSH_OPTS "$REMOTE_HOST" "mkdir -p ${REMOTE_DIR}/tailscale"
scp $SSH_OPTS "$COMPOSE_TMP" "${REMOTE_HOST}:${REMOTE_DIR}/docker-compose.yml"
scp $SSH_OPTS tailscale/serve.json "${REMOTE_HOST}:${REMOTE_DIR}/tailscale/serve.json"

# Write APP_VERSION to remote .env (preserving any existing vars like TS_AUTHKEY)
ssh $SSH_OPTS "$REMOTE_HOST" "
  cd ${REMOTE_DIR}
  if [[ -f .env ]]; then
    sed -i '/^APP_VERSION=/d' .env
  fi
  echo 'APP_VERSION=${APP_VERSION}' >> .env
"

# 4. Pull latest image and restart on lab-services
echo "==> Starting services on ${REMOTE_HOST}..."
ssh $SSH_OPTS "$REMOTE_HOST" "
  cd ${REMOTE_DIR}
  docker compose pull
  docker compose up -d
"

echo "==> Done. aitodo v${APP_VERSION} is running on ${REMOTE_HOST}."
