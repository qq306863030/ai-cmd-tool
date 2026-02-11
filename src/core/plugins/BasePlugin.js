class BasePlugin {
  constructor(aiCli) {
    this.aiCli = aiCli;
    this.parser = this.aiCli.aiResultParser;
    this.aiService = this.aiCli.aiService;
  }

  // 程序初始化后的函数
  async onInitialize() {
    // 子类可以重写此方法
  }

  // ai请求前的函数
  async onBeforeAIRequest(messages) {
    // 子类可以重写此方法
    return messages;
  }

  // ai请求后的函数，参数是ai请求返回的原始数据，返回参数是函数处理后的数据
  async onAfterAIRequest(rawData) {
    // 子类可以重写此方法
    return rawData;
  }

  // 解析完成后的函数，参数是解析后的对象，返回值也是解析后的对象
  async onAfterParse(steps) {
    // 子类可以重写此方法
    return steps;
  }

  // 每一步执行前的函数,参数是步骤对象,返回值也是当前的步骤对象
  async onBeforeStep(steps, stepIndex, step) {
    // 子类可以重写此方法
    return step;
  }

  // 每一步执行后的函数, 参数是outputList，步骤的索引
  async onAfterStep(steps, stepIndex, step, outputList) {
    // 子类可以重写此方法
  }

  // 整个步骤执行完成的函数, 参数是outputList
  async onAfterAllSteps(steps, outputList) {
    // 子类可以重写此方法
  }
}

module.exports = BasePlugin