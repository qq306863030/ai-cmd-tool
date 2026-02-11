class BaseExtension {
  constructor(aiCli) {
    this.aiCli = aiCli;
    this.parser = this.aiCli.aiResultParser;
    this.aiService = this.aiCli.aiService;
    this.baseFunction = this.parser.baseFunction;
  }
  // your extends...

  // 扩展函数描述(重写方法)
  getDescriptions() {
    return [
      {
        name: "",
        type: "function", // 'other'、'function'，default: 'function'
        params: [],
        description: "",
      },
    ];
  }
}

module.exports = BaseExtension;
