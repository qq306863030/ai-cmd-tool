const { logInfo } = require("../utils");
const BasePlugin = require("./BasePlugin");

class DefaultPlugin extends BasePlugin {
  async onAfterAIRequest(rawData) {
    return rawData;
  }

  async onAfterParse(steps) {
    if (this.aiCli.config.outputAiResult) {
      if (steps && steps.length === 1 && steps[0].type === 1) {
        return steps;
      }
      logInfo(JSON.stringify(steps, null, 2))
    }
    // 子类可以重写此方法
    return steps;
  }
}

module.exports = DefaultPlugin;