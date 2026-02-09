# 🚀 Quick Start - Test Your Router NOW

## One-Command Health Check

```bash
# Verify everything is ready
docker compose ps && \
echo "✅ Services running" && \
curl -s http://localhost:3001/api/images | jq -r '.customImages[] | select(.name | contains("router")) | "✅ Router image: \(.name) (\(.size))"'
```

## Open the UI and Test

```bash
# Option 1: If you have xdg-open
xdg-open http://localhost:3000

# Option 2: Just copy this URL to your browser
http://localhost:3000
```

## Create Router Node (UI Steps)

1. **Click**: "Create New Node" button
2. **Select**: Custom Images tab
3. **Choose**: `router_1762805489189`
4. **Name**: "Task2-Router" (or anything)
5. **Click**: "Create"
6. **Click**: ▶ Start button
7. **Wait**: 30-60 seconds
8. **Click**: "Serial Console" button
9. **Wait**: For `Router>` prompt

## Commands to Paste (After You See `Router>`)

```cisco
enable
configure terminal
interface GigabitEthernet0/0
 ip address 192.168.1.1 255.255.255.0
 no shutdown
 exit
interface GigabitEthernet0/1
 ip address 192.168.2.1 255.255.255.0
 no shutdown
 exit
hostname Task2-Router
end
write memory
```

## Verify It Worked

```cisco
show ip interface brief
```

**Expected Output:**
```
Interface                  IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0         192.168.1.1     YES manual up                    up      
GigabitEthernet0/1         192.168.2.1     YES manual up                    up
```

## Monitor Backend Logs

```bash
# Watch router boot in real-time
docker compose logs -f backend | grep -E "router|Router|QEMU"
```

**You should see:**
```
📡 Detected Cisco router image: router_1762805489189
🔧 Platform: c3725
⚠️  Router mode: Serial console is PRIMARY interface
✅ VM started: PID 12345
```

## Troubleshooting

### Problem: Nothing in Serial Console
```bash
# Wait 60 seconds, then check:
docker exec sandlabx-backend ps aux | grep qemu
```

### Problem: Can't Create Node
```bash
# Check API health:
curl http://localhost:3001/api/health
```

### Problem: WebSocket Error
```bash
# Restart backend:
docker compose restart backend
```

## Success Indicators

✅ Backend logs show: "📡 Detected Cisco router image"  
✅ Serial console shows boot messages  
✅ You see `Router>` prompt  
✅ Commands respond (try `enable`)  
✅ `show ip interface brief` shows 2 interfaces  

## Quick Reference

- **UI**: http://localhost:3000
- **API**: http://localhost:3001/api
- **Guacamole**: http://localhost:8081/guacamole
- **Docs**: `ROUTER-TESTING-GUIDE.md`

---

**Ready? Open http://localhost:3000 and let's boot that router!** 🎯
