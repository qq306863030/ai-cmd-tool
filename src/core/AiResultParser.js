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
            // 执行内置函数
            this.outputList.push(await this.executeBuiltInFunction(content));
            break;
          case 3:
            if (content.startsWith("baseFunction")) {
              this.outputList.push(await this.executeBuiltInFunction(content));
            } else {
              // 执行系统命令
              this.outputList.push(
                await this.baseFunction.executeCommand_0(content),
              );
            }
            break;
          case 4:
            if (content.startsWith("baseFunction")) {
              this.outputList.push(await this.executeBuiltInFunction(content));
            } else {
              // 执行Node.js代码
              this.outputList.push(
                await this.baseFunction.executeJSCode_0(content),
              );
            }
            break;
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

  async executeBuiltInFunction(command) {
    const trimmedCommand = command.trim();
    if (trimmedCommand.startsWith("baseFunction")) {
      // 执行baseFunction中的函数
      const parseRes = this._parseFunctionStr(trimmedCommand);
      if (!parseRes) {
        return null;
      }
      const { objectName, functionName, paramsStr } = parseRes;
      if (!objectName || !functionName) {
        return null;
      }
      const args = this._parseFunctionArgs(paramsStr);
      return await this.baseFunction[functionName](...args);
    } else {
      return this.executeBuiltInFunction("baseFunction." + trimmedCommand);
    }
  }

  _parseFunctionStr(str) {
    // 查询第一个括号的位置
    const firstBracketIndex = str.indexOf("(");
    if (firstBracketIndex === -1) {
      return null;
    }
    const lastBracketIndex = str.lastIndexOf(")");
    if (lastBracketIndex === -1) {
      return null;
    }
    const str1 = str.slice(0, firstBracketIndex);
    const str2 = str.slice(firstBracketIndex + 1, lastBracketIndex - 1);
    const [objectName, functionName] = str1.split(".");
    const paramsStr = str2;
    // 分组解析结果
    return {
      objectName,
      functionName,
      paramsStr,
    };
  }

  _parseFunctionArgs(argsString) {
    const specialSymbol = "@@ai-arg@@";
    if (argsString.includes(specialSymbol)) {
      const parts = argsString.split(specialSymbol);
      const args = parts.slice(1).map((arg) => {
        let item = arg.trim().replace(/^['"]|(['"](,)?)$/g, "");
        if (item.startsWith("outputList")) {
          // 解析outputList[1]等
          const index = parseInt(
            item.replace("outputList[", "").replace("]", ""),
          );
          return this.outputList[index] || "";
        }
        return item;
      });
      return args;
    } else {
      const args = argsString.split(",");
      return args.map((arg) => arg.trim().replace(/^['"]|(['"](,)?)$/g, ""));
    }
  }
}

module.exports = AiResultParser;
