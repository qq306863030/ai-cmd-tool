const { logInfo, logError, logSuccess, streamOutput } = require("./utils");

class AiResultParser {
  constructor(aiCli) {
    this.baseFunction = {};
    this.outputList = [];
    this.aiCli = aiCli;
  }

  // 解析并执行AI返回的步骤
  async executeSteps(steps, pluginManager = null) {
    this.clear();
    for (let i = 0; i < steps.length; i++) {
      let step = steps[i];

      // 每一步执行前的钩子
      if (pluginManager) {
        step = await pluginManager.onBeforeStep(steps, i, step);
      }

      const { type, content, description } = step;
      try {
        if (description) {
          logInfo(description);
        }
        switch (type) {
          case 1:
            // 输出普通信息
            if (this.aiCli.config.ai?.stream) {
              await streamOutput(content, 10);
            } else {
              logSuccess(content);
            }
            this.outputList.push(content);
            break;
          case 2:
            // 执行Node.js代码
            this.outputList.push(
              await this.baseFunction.executeJSCode_0(content),
            );
            break;
          case 3:
            if (content.startsWith("baseFunction")) {
              // 执行Node.js代码
              this.outputList.push(
                await this.baseFunction.executeJSCode_0(content),
              );
            } else {
              // 执行系统命令
              this.outputList.push(
                await this.baseFunction.executeCommand_0(content),
              );
            }
            break;
          case 4:
            // 执行Node.js代码
            this.outputList.push(
              await this.baseFunction.executeJSCode_0(content),
            );
            break;
          case 5:
            // 递归调用ai，处理特别复杂的场景
            await this.aiCli.run(content);
            return
          default:
            // 默认只输出信息
            logSuccess(content);
            this.outputList.push(content);
            break;
        }

        // 每一步执行后的钩子
        if (pluginManager) {
          await pluginManager.onAfterStep(steps, i, step, this.outputList);
        }
      } catch (error) {
        logError(`Error executing step (type ${type}): ${error.message}`);
      }
    }

    // 整个步骤执行完成的钩子
    if (pluginManager) {
      await pluginManager.onAfterAllSteps(steps, this.outputList);
    }
  }

  clear() {
    this.outputList = [];
  }
}

module.exports = AiResultParser;
