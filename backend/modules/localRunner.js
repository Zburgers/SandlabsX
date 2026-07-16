class LocalRunner {
  constructor(options = {}) {
    this.planCompiler = options.planCompiler;
    this.execute = options.execute;
  }

  async run(operation, context) {
    if (typeof this.execute !== 'function') throw Object.assign(new Error('No local runner is configured for host execution'), { code: 'RUNNER_UNAVAILABLE' });
    return this.execute(operation, context);
  }
}

module.exports = { LocalRunner };
