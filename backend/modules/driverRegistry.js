class DriverRegistry {
  constructor(drivers = []) { this.drivers = new Map(drivers.map(driver => [driver.name, driver])); }

  register(driver) {
    if (!driver?.name || typeof driver.compileProcess !== 'function') throw new TypeError('Driver requires name and compileProcess');
    this.drivers.set(driver.name, driver);
    return this;
  }

  get(name) {
    const driver = this.drivers.get(name);
    if (!driver) throw Object.assign(new Error(`Unsupported node driver: ${name}`), { code: 'UNSUPPORTED_DRIVER' });
    return driver;
  }
}

function createDefaultDriverRegistry() {
  const registry = new DriverRegistry();
  const base = {
    validate(node) {
      if (!node.image) throw Object.assign(new Error('Node image is required'), { code: 'IMAGE_REQUIRED' });
    },
    compileProcess(node, context) {
      const args = [
        '-name', `sandlabx-${context.instanceId}-${context.nodeId}`,
        '-machine', context.acceleration === 'kvm' ? 'q35,accel=kvm' : 'q35,accel=tcg',
        '-smp', String(node.resources.vcpus),
        '-m', String(node.resources.memoryMiB),
        '-drive', `file=${context.overlayPath},format=qcow2,if=virtio`
      ];
      for (const nic of context.interfaces) {
        args.push('-netdev', `tap,id=${nic.netdev},ifname=${nic.tap},script=no,downscript=no`);
        args.push('-device', `${nic.model || 'virtio-net-pci'},netdev=${nic.netdev},mac=${nic.mac}`);
      }
      return args;
    }
  };
  registry.register({ ...base, name: 'qemu-generic', consoleType: 'vnc' });
  registry.register({ ...base, name: 'qemu-linux-cloud', consoleType: 'vnc' });
  registry.register({
    ...base,
    name: 'qemu-serial-router',
    consoleType: 'serial',
    compileProcess(node, context) {
      return [...base.compileProcess(node, context), '-nographic', '-serial', `telnet:127.0.0.1:${context.consolePort},server=on,wait=off`];
    }
  });
  return registry;
}

module.exports = { DriverRegistry, createDefaultDriverRegistry };
