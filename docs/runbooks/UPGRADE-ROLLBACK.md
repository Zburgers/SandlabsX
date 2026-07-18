# Upgrade and rollback

Run `make prepare`, `make doctor`, `docker compose config --quiet`, database backup, then migrations before replacing application containers. Migration `0009` is irreversible and intentionally refuses non-empty legacy tables.

Rollback application code only to a version compatible with the applied schema. Do not attempt to recreate removed legacy runtime tables from an application rollback; restore a verified database backup instead.
