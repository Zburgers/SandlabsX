SHELL := /usr/bin/env bash
COMPOSE ?= docker compose
STACK := bash ./scripts/stack.sh

.PHONY: help prepare doctor install test build up rebuild down restart logs ps clean image-init image-list image-doctor

help:
	@printf '%s\n' \
	  'SandLabX development commands' \
	  '' \
	  '  make prepare       Create runtime directories' \
	  '  make doctor        Check host virtualization prerequisites' \
	  '  make install       Install backend and frontend dependencies' \
	  '  make test          Run backend tests' \
	  '  make build         Build application containers only' \
	  '  make up            Start existing images without rebuilding' \
	  '  make rebuild       Rebuild application images and start' \
	  '  make down          Stop the stack' \
	  '  make logs          Follow stack logs' \
	  '  make image-init    Explicitly validate/download legacy base images' \
	  '  make image-list    List managed custom images'

prepare:
	@mkdir -p images/custom overlays vms pids checkpoints
	@printf 'Runtime directories are ready.\n'

doctor:
	@bash ./scripts/dev-doctor.sh

install:
	cd backend && npm install --no-audit --no-fund
	cd frontend && npm ci --no-audit --no-fund

test:
	cd backend && npm test

build:
	$(COMPOSE) build

up: prepare
	$(STACK) up

rebuild: prepare
	$(STACK) rebuild

down:
	$(STACK) down

restart:
	$(STACK) restart

logs:
	$(STACK) logs

ps:
	$(STACK) status

clean:
	$(COMPOSE) down --remove-orphans
	@find overlays -maxdepth 1 -type f -name '*.qcow2' -print
	@printf 'Overlay files were not deleted automatically. Remove them explicitly after review.\n'

# LEGACY compatibility command. Eager image scanning was removed from backend
# startup. Prefer ImagePipeline catalog/import commands for all new workflows.
image-init:
	$(COMPOSE) run --rm --no-deps --entrypoint /usr/local/bin/init-images.sh \
	  -e AUTO_DOWNLOAD_IMAGES=$${AUTO_DOWNLOAD_IMAGES:-false} backend

image-list:
	cd backend && npm run image:list

image-doctor:
	cd backend && npm run image:doctor
