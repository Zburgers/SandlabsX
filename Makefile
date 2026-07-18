SHELL := /usr/bin/env bash
COMPOSE ?= docker compose
STACK := bash ./scripts/stack.sh

.PHONY: help prepare doctor network-audit verify install test build up rebuild down restart logs ps clean db-migrate db-check db-create-migration image-init image-list image-doctor

help:
	@printf '%s\n' \
	  'SandLabX development commands' \
	  '' \
	  '  make prepare             Create runtime directories' \
	  '  make doctor              Check host virtualization prerequisites' \
	  '  make network-audit       Read-only host network safety report' \
	  '  make verify              Verify runtime, migrations, and network invariants' \
	  '  make install             Install backend and frontend dependencies' \
	  '  make test                Run backend tests' \
	  '  make build               Build application containers only' \
	  '  make up                  Start existing images without rebuilding' \
	  '  make rebuild             Rebuild, migrate, and start the stack' \
	  '  make down                Stop the stack' \
	  '  make logs                Follow stack logs' \
	  '  make db-migrate          Apply pending SandLabX migrations' \
	  '  make db-check            Verify migration ledger and required tables' \
	  '  make db-create-migration NAME=description' \
	  '  make image-init          Explicitly validate/download legacy base images' \
	  '  make image-list          List managed custom images'

prepare:
	@mkdir -p images/custom overlays vms pids checkpoints
	@for directory in images images/custom overlays vms pids checkpoints; do \
	  if [[ ! -w "$$directory" ]]; then \
	    printf 'ERROR: %s is not writable by uid %s. Stop the stack, then repair only the bind-mount root with: sudo chown %s:%s %q\n' "$$directory" "$$(id -u)" "$$(id -u)" "$$(id -g)" "$$directory" >&2; \
	    exit 1; \
	  fi; \
	done
	@printf 'Runtime directories are ready.\n'

doctor:
	@bash ./scripts/dev-doctor.sh

network-audit:
	@bash ./scripts/network-audit.sh

verify:
	@bash ./scripts/verify-setup.sh

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

db-migrate:
	$(COMPOSE) run --rm --no-deps --build migrate

db-check:
	$(COMPOSE) run --rm --no-deps --entrypoint node migrate scripts/check-schema.js

db-create-migration:
	@test -n "$(NAME)" || (printf 'Usage: make db-create-migration NAME=description\n' >&2; exit 64)
	cd backend && npm run db:migrate:create -- "$(NAME)"

# LEGACY compatibility command. Eager image scanning was removed from backend
# startup. Prefer ImagePipeline catalog/import commands for all new workflows.
image-init:
	$(COMPOSE) run --rm --no-deps --entrypoint /usr/local/bin/init-images.sh \
	  -e AUTO_DOWNLOAD_IMAGES=$${AUTO_DOWNLOAD_IMAGES:-false} backend

image-list:
	cd backend && npm run image:list

image-doctor:
	cd backend && npm run image:doctor
