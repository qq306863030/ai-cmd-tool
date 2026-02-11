const OllamaService = require("./ai-services/OllamaService");
const DeepSeekService = require("./ai-services/DeepSeekService");
const OpenaiService = require("./ai-services/OpenaiService");
const AiResultParser = require("./AiResultParser");
const PluginManager = require("./plugins/PluginManager");
const ExtensionManager = require("./extends/ExtensionManager");
const readline = require("readline");
const { logError } = require("./utils");

class AICLI {
  constructor(config) {
    this.config = config;
    this.initialize();
  }
  // 解析配置文件
  initialize() {
    const service = this.config.ai?.type || "ollama";
    if (service === "deepseek") {
      this.aiService = new DeepSeekService();
    } else if (service === "openai") {
      this.aiService = new OpenaiService();
    } else {
      this.aiService = new OllamaService();
    }
    this.aiResultParser = new AiResultParser(this);
    // 初始化插件管理器
    this.pluginManager = new PluginManager(this);
    // 加载配置中的插件
    if (this.config.plugins) {
      this.pluginManager.parsePlugin(this.config.plugins);
    }
    // 初始化扩展
    this.extensionManager = new ExtensionManager(this);
    if (this.config.extends) {
      this.extensionManager.parseExtend(this.config.extends);
    }
    // 初始化扩展
    this.extensionManager.init();
    // 程序启动后执行插件的初始化生命周期函数
    this.pluginManager.onInitialize();
  }

  async run(userPrompt) {
    try {
      // AI请求前的钩子
      const messages = this.aiService.initPrompt(userPrompt);
      const promptResult = await this.pluginManager.onBeforeAIRequest(messages);
      const response = await this.aiService.generateResponse(promptResult);
      // AI请求后的钩子
      const processedResponse =
        await this.pluginManager.onAfterAIRequest(response);

      const steps = this.parseResponse(processedResponse);

      // 解析完成后的钩子
      const processedSteps = await this.pluginManager.onAfterParse(steps);

      if (processedSteps.length > 1) {
        console.log("Executing steps...");
      }

      // 执行步骤（这里需要修改AiResultParser来支持插件钩子）
      await this.aiResultParser.executeSteps(
        processedSteps,
        this.pluginManager,
      );

      if (!(processedSteps.length === 1 && processedSteps[0].type === 1)) {
        console.log("Execution completed.");
      }

      this.aiService.conversationHistory.push({
        role: "user",
        content: userPrompt,
      });
      this.aiService.conversationHistory.push({
        role: "assistant",
        content: processedResponse,
      });
    } catch (error) {
      logError(error.stack);
      throw error;
    }
  }

  startInteractive() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "> ",
    });

    console.log("AI CLI Assistant");
    console.log('Type your question or command. Type "exit" to quit.');
    console.log("=".repeat(50));
    rl.prompt();

    rl.on("line", async (line) => {
      const input = line.trim();

      if (input.toLowerCase() === "exit") {
        rl.close();
        return;
      }

      try {
        await this.run(input);
      } catch (error) {
        console.error("Error:", error.message);
      }

      console.log("=".repeat(50));
      rl.prompt();
    });

    rl.on("close", () => {
      console.log("Goodbye!");
      process.exit(0);
    });
  }

  parseResponse(response) {
    response = response.trim().replace(/^```json\n|```$/g, "");
    try {
      const steps = JSON.parse(response);
      if (Array.isArray(steps)) {
        return steps
      } else {
        return [{ type: 1, content: response, description: "" }];
      }
    } catch (error) {
      logError("返回数据解析错误," + error.stack);
      return [{ type: 1, content: response, description: "" }];
    }
  }
}

module.exports = AICLI;
