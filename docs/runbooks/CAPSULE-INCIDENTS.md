# Capsule incidents

Treat `/api/health/ready` as the dependency summary. A `503` means a required dependency is unavailable; `degraded` means an optional dependency needs investigation.

For a failed operation, retain its ID and request ID, inspect owner-scoped events, then inspect runner logs. Do not delete overlays, TAPs, bridges, or checkpoints as a first response. Confirm instance ownership and the operation compensation record before cleanup.

If the runner lease is stale, stop only the identified runner process, preserve operation records, and restart after confirming the database is reachable. Escalate any unowned network resource instead of deleting it.
