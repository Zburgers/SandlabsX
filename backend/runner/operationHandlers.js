'use strict';
function createOperationHandlers({ disk, network, qemu, console: consoleService, checkpoints, capture }) {
  const noOp = key => () => [{ key, run: async () => {} }];
  return { PLAN: noOp('plan'), PROVISION: noOp('provision'), START: noOp('start'), STOP: noOp('stop'), LINK_STATE: noOp('link-state'), CHECKPOINT: noOp('checkpoint'), RESTORE: noOp('restore'), RESET: noOp('reset'), CAPTURE: noOp('capture'), DESTROY: noOp('destroy') };
}
module.exports = { createOperationHandlers };
