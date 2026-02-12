const path = require("path");
const { spawn } = require("child_process");
const { logError, logSuccess, logInfo } = require("../utils");
const BaseExtension = require("./BaseExtension");
const dayjs = require("dayjs");
const axios = require("axios");
const fs = require("fs-extra");

class DefaultExtension extends BaseExtension {
  constructor(aiCli) {
    super(aiCli);
    this.dayjs = dayjs;
    this.axios = axios;
    this.fs = fs;
  }
  getDescriptions() {
    return [
      {
        name: "createFile",
        params: ["filePath", "content"],
        description: "创建一个包含指定内容的新文件",
      },
      {
        name: "createDirectory",
        params: ["dirPath"],
        description: "创建一个新目录",
      },
      {
        name: "modifyFile",
        params: ["filePath", "content"],
        description: "修改指定文件的内容",
      },
      {
        name: "readFile",
        params: ["filePath"],
        description: "读取指定文件的内容，返回文件内容的字符串",
      },
      {
        name: "appendToFile",
        params: ["filePath", "content"],
        description: "向指定文件追加内容",
      },
      {
        name: "fileExists",
        params: ["filePath"],
        description: "检查指定文件是否存在，返回true或false",
      },
      {
        name: "deleteFile",
        params: ["filePath"],
        description: "删除指定文件",
      },
      {
        name: "deleteDirectory",
        params: ["dirPath"],
        description: "删除指定目录",
      },
      {
        name: "rename",
        params: ["oldPath", "newPath"],
        description: "重命名文件或目录",
      },
      {
        name: "moveFile",
        params: ["sourcePath", "destinationPath"],
        description: "移动文件",
      },
      {
        name: "getFileInfo",
        params: ["filePath"],
        description: "获取指定文件的信息，返回文件信息的对象",
      },
      {
        name: "getFileNameList",
        params: ["dirPath"],
        description: "获取指定目录下的所有文件名，返回文件名数组",
      },
      {
        name: "clearDirectory",
        params: ["dirPath"],
        description: "清空指定目录的内容",
      },
      {
        name: "executeCommand",
        params: ["command"],
        description: "执行系统命令",
      },
      {
        name: "requestAI",
        params: ["systemDescription", "prompt"],
        description:
          "请求AI服务处理简单任务，如随机生成一段话、翻译文本、数学计算、代码分析、知识检索等。通过systemDescription参数指定AI的行为和限制，prompt参数输入任务描述。返回AI处理后的结果，仅包含所需的输出内容，不包含任何解释或额外信息，确保返回的结果能够被解析。",
      },
      {
        name: "executeJSCode",
        params: ["code"],
        description: "执行JavaScript代码",
      },
      {
        name: "dayjs",
        type: "object",
        params: [],
        description: "内置的dayjs库, 使用dayjs库处理日期时间",
      },
      {
        name: "axios",
        type: "object",
        params: [],
        description: "内置的axios库, 用于发送HTTP请求",
      },
      {
        name: "fs",
        type: "object",
        params: [],
        description: "内置的fs-extra库, 用于文件操作",
      },
    ];
  }

  // 执行系统命令
  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      logInfo(`Executing system command: ${command}`);

      const childProcess = spawn(command, {
        shell: true,
        cwd: process.cwd(),
        stdio: "inherit",
      });

      childProcess.on("error", (error) => {
        logError(`Error executing system command: ${error.message}`);
        reject(error);
      });

      childProcess.on("close", (code) => {
        if (code !== 0) {
          const error = new Error(
            `System command failed with exit code ${code}`,
          );
          logError(`Error executing system command: ${error.message}`);
          reject(error);
          return;
        }
        logSuccess(`System command executed successfully`);
        resolve("System command executed successfully");
      });
    });
  }

  // 请求ai服务
  async requestAI(systemDescription, prompt) {
    if (
      typeof systemDescription === "object" &&
      systemDescription.systemDescription
    ) {
      prompt = systemDescription.prompt || prompt || "";
      systemDescription = systemDescription.systemDescription || "";
    }
    try {
      const response = await this.aiService.derictGenerateResponse(
        systemDescription,
        prompt,
      );
      return response;
    } catch (error) {
      logError(`Error executing AI function: ${error.message}`);
      throw error;
    }
  }

  // 执行js代码
  async executeJSCode(code) {
    if (code.startsWith("baseFunction")) {
      code = `return (${code})`;
    }
    try {
      const asyncFunc = new Function(
        "baseFunction",
        "outputList",
        "require",
        "return (async () => { " + code + " })()",
      );
      const result = await asyncFunc(this.baseFunction, this.parser.outputList, require);
      return result;
    } catch (error) {
      logError(`Error executing code: ${error.stack}`);
      throw error;
    }
  }

  async createFile(filePath, content) {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      const dirPath = path.dirname(fullPath);

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(fullPath, content);
      return true;
    } catch (error) {
      return false;
    }
  }

  async modifyFile(filePath, content) {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);

      if (!fs.existsSync(fullPath)) {
        return false;
      }

      fs.writeFileSync(fullPath, content);
      return true;
    } catch (error) {
      return false;
    }
  }

  async readFile(filePath) {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);

      if (!fs.existsSync(fullPath)) {
        return null;
      }

      const content = fs.readFileSync(fullPath, "utf8");
      return content;
    } catch (error) {
      return null;
    }
  }

  async appendToFile(filePath, content) {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);

      if (!fs.existsSync(fullPath)) {
        return false;
      }

      fs.appendFileSync(fullPath, content);
      return true;
    } catch (error) {
      return false;
    }
  }

  fileExists(filePath) {
    const fullPath = path.resolve(process.cwd(), filePath);
    return fs.existsSync(fullPath);
  }

  async createDirectory(dirPath) {
    try {
      const fullPath = path.resolve(process.cwd(), dirPath);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async deleteFile(filePath) {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async deleteDirectory(dirPath) {
    try {
      const fullPath = path.resolve(process.cwd(), dirPath);

      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async rename(oldPath, newPath) {
    try {
      const fullOldPath = path.resolve(process.cwd(), oldPath);
      const fullNewPath = path.resolve(process.cwd(), newPath);

      if (fs.existsSync(fullOldPath)) {
        fs.renameSync(fullOldPath, fullNewPath);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async moveFile(sourcePath, destinationPath) {
    try {
      const fullSourcePath = path.resolve(process.cwd(), sourcePath);
      const fullDestPath = path.resolve(process.cwd(), destinationPath);
      const destDirPath = path.dirname(fullDestPath);

      if (!fs.existsSync(destDirPath)) {
        fs.mkdirSync(destDirPath, { recursive: true });
      }

      if (fs.existsSync(fullSourcePath)) {
        fs.renameSync(fullSourcePath, fullDestPath);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async getFileInfo(filePath) {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);

      if (!fs.existsSync(fullPath)) {
        return null;
      }

      const stats = fs.statSync(fullPath);
      return {
        path: fullPath,
        size: stats.size,
        birthtime: stats.birthtime,
        mtime: stats.mtime,
        ctime: stats.ctime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
      };
    } catch (error) {
      return null;
    }
  }

  async getFileNameList(dirPath) {
    try {
      const fullPath = path.resolve(process.cwd(), dirPath);
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
        return [];
      }
      const files = fs.readdirSync(fullPath);
      return files;
    } catch (error) {
      return [];
    }
  }

  async clearDirectory(dirPath) {
    try {
      const fullPath = path.resolve(process.cwd(), dirPath);

      if (!fs.existsSync(fullPath)) {
        return false;
      }

      if (!fs.statSync(fullPath).isDirectory()) {
        return false;
      }

      const files = fs.readdirSync(fullPath);

      for (const file of files) {
        const filePath = path.join(fullPath, file);
        if (fs.statSync(filePath).isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = DefaultExtension;
