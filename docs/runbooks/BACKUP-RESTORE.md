# Backup and restore

Back up PostgreSQL and the managed image, overlay, and checkpoint roots together. Record image digests and the migration ledger with the backup.

Restore PostgreSQL first, run `make db-check`, then restore managed image data. Do not restore mutable overlays onto a different Capsule version. Test restore in an isolated host before changing a live stack.
