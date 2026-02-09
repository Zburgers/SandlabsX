# SandlabX Environment Rebuild Playbook

This doc captures the exact steps I ran to bring the lab back online after switching Docker contexts. It stitches together the scattered scripts and highlights the gotchas (ports, sudo, router timing) so you can repeat the process quickly.

## 1. Reset and Seed PostgreSQL

```bash
chmod +x init-postgres.sh
./init-postgres.sh --reset-volume
```

What it does:
- Stops/removes every Compose service, wipes the `pgdata` volume, and recreates it
- Mounts both `initdb-schema.sql` (Guacamole) and `backend/schema/nodes-schema.sql` (SandlabX nodes)
- Waits for Postgres readiness before applying schemas
- Recreates the `sandlabx_nodes` table and constraints. Confirm via:
  ```bash
  docker compose exec -T postgres psql -U guacamole_user -d guacamole_db -c "\dt sandlabx_*"
  ```

## 2. Rebuild Host Networking (bridges + tap scripts)

`backend/setup-network.sh` needs root because it touches `/etc/qemu-ifup`. Make it executable and run with sudo:

```bash
chmod +x backend/setup-network.sh
sudo ./backend/setup-network.sh
```

Results:
- Creates bridges `sandlabx-br0` (192.168.1.1/24) and `sandlabx-br1` (192.168.2.1/24)
- Enables IPv4 forwarding
- Writes `/etc/qemu-ifup` / `/etc/qemu-ifdown` that map tap0/2 → br0 and tap1/3 → br1
- Verify anytime with `ip addr show sandlabx-br0` and `ip addr show sandlabx-br1`

## 3. Launch the Full Stack

```bash
./run-all.sh
```

This script already wraps:
- Dependency install checks (`npm install` if missing)
- `docker compose up -d` for postgres, guacd, guacamole, backend, frontend
- Local `node server.js` + `next dev` for rapid debugging

> ⚠ **Port 3000 collision**: the Docker `sandlabx-frontend` container already binds host 3000. If you want the host-side Next dev server too, stop the container first (`docker compose stop frontend`) or change `NEXT_PORT` in `run-all.sh`. I left the container running and skipped the extra dev server.

Check status anytime:
```bash
./status.sh
```
You should see postgres, guacd, guacamole, backend, and frontend containers `Up`. Backend health endpoint confirms API readiness:
```bash
curl -s http://localhost:3001/api/health
```

## 4. Stand Up the Lab Topology

`setup-network-lab.sh` orchestrates the Task‑2 topology (Router + PC1 + PC2) through the REST API:

```bash
./setup-network-lab.sh
```

It will:
1. Wait for `/api/nodes`
2. Create three nodes (router image + 2 Debian PCs)
3. Boot them (router boot takes ~3 minutes — don’t interrupt)
4. Push Cisco interface config via `/api/nodes/:id/configure-router`

If the auto-config step times out, wait another 60–90 seconds and re-run the curl manually:
```bash
ROUTER_ID=<uuid printed by script>
cat <<'JSON' | curl -s -X POST http://localhost:3001/api/nodes/$ROUTER_ID/configure-router \
  -H "Content-Type: application/json" -d @-
{
  "hostname": "Router",
  "enableSecret": "cisco123",
  "interface0": {"ip": "192.168.1.1", "mask": "255.255.255.0"},
  "interface1": {"ip": "192.168.2.1", "mask": "255.255.255.0"},
  "routes": []
}
JSON
```

Use `curl http://localhost:3001/api/nodes | jq '.nodes[] | {name,status}'` to confirm every node is `running` before hopping into Guacamole.

## 5. Optional Cleanup / Redeploy

When you need a clean slate:
```bash
docker compose down -v
rm -rf pgdata
```
Then repeat steps 1–4.

To rebuild containers after source changes:
```bash
docker compose down
docker compose up -d --build
```

## 6. Quick Reference: Key Scripts

| Script | Purpose |
| --- | --- |
| `init-postgres.sh` | Idempotent Postgres reset + schema loader (includes SandlabX nodes table) |
| `backend/setup-network.sh` | Host bridges, tap mappings, `/etc/qemu-ifup`/`ifdown`, IPv4 forwarding |
| `run-all.sh` | Orchestrates Docker services + optional host dev servers |
| `setup-network-lab.sh` | Creates/boots Router + PC nodes and configures router interfaces |
| `status.sh` | Shows Docker container state + host PID tracking |
| `stop-all.sh` | Stops host dev servers, then `docker compose down` |

That’s the full lifecycle to rebuild the environment after switching Docker engines.
