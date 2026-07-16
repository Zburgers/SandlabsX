SHELL := /usr/bin/env bash
COMPOSE ?= docker compose

.PHONY: help prepare doctor install test build up down restart logs ps clean image-list image-doctor

help:
	@printf '%s\n' \
	  'SandLabX development commands' \
	  '' \
	  '  make prepare       Create runtime directories' \
	  '  make doctor        Check host virtualization prerequisites' \
	  '  make install       Install backend and frontend dependencies' \
	  '  make test          Run backend tests' \
	  '  make build         Build application containers' \
	  '  make up            Start the stack' \
	  '  make down          Stop the stack' \
	  '  make logs          Follow stack logs' \
	  '  make image-list    List managed custom images'

prepare:
	@mkdir -p images/custom overlays vms pids
	@printf 'Runtime directories are ready.\n'

doctor:
	@bash ./scripts/dev-doctor.sh

install:
	cd backend && npm install --no-audit --no-fund
	cd frontend && npm install --no-audit --no-fund

test:
	cd backend && npm test

build:
	$(COMPOSE) build

up: prepare
	$(COMPOSE) up -d --build
	$(COMPOSE) ps

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps

clean:
	$(COMPOSE) down --remove-orphans
	@find overlays -maxdepth 1 -type f -name '*.qcow2' -print
	@printf 'Overlay files were not deleted automatically. Remove them explicitly after review.\n'

image-list:
	cd backend && npm run image:list

image-doctor:
	cd backend && npm run image:doctor
