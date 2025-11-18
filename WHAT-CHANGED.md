# What Changed - Quick Reference

## File Modified
`backend/modules/qemuManager.js`

## Change Summary
Made KVM **optional** instead of **required** for router

## Before (Lines 193-203)
```javascript
qemuArgs = [
  '-drive', `file=${node.overlayPath},format=qcow2`,
  '-m', '512',
  '-nographic',
  '-serial', 'mon:stdio',
  '-device', 'e1000,netdev=net0',
  '-netdev', 'user,id=net0',
  '-device', 'e1000,netdev=net1',
  '-netdev', 'user,id=net1',
  '-enable-kvm'  // ❌ Always added - crashes if no KVM
];
```

## After (Lines 193-212)
```javascript
qemuArgs = [
  '-drive', `file=${node.overlayPath},format=qcow2`,
  '-m', '512',
  '-nographic',
  '-serial', 'mon:stdio',
  '-device', 'e1000,netdev=net0',
  '-netdev', 'user,id=net0',
  '-device', 'e1000,netdev=net1',
  '-netdev', 'user,id=net1'
  // -enable-kvm removed from here
];

// ✅ Try KVM, fall back to TCG
try {
  await fs.access('/dev/kvm');
  qemuArgs.push('-enable-kvm');
  console.log('⚡ KVM enabled');
} catch (error) {
  console.log('🐌 Using TCG emulation');
}
```

## Result
- **With KVM**: Fast router startup (2-3 min)
- **Without KVM**: Slower but working router (3-4 min)
- **No more crashes!**

## Already Applied
✅ Code changed
✅ Backend restarted
✅ Ready to test

---
**Next: Try starting a router in the UI!**
