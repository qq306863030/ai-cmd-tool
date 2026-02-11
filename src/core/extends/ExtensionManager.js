const DefaultExtension = require("./DefaultExtension");

class ExtensionManager {
  constructor(aiCli) {
    this.aiCli = aiCli;
    this.extensions = [DefaultExtension];
  }


  parseExtends(configExtends) {
    if (!Array.isArray(configExtends)) {
      return;
    }

    for (const extensionPath of configExtends) {
      try {
        // 解析扩展路径
        const resolvedPath = path.isAbsolute(extensionPath)
          ? extensionPath
          : path.resolve(process.cwd(), extensionPath);

        if (!fs.existsSync(resolvedPath)) {
          console.error(`Plugin file not found: ${resolvedPath}`);
          continue;
        }

        // 动态加载扩展模块
        const ExtendModule = require(resolvedPath);

        // 检查扩展是否继承自BasePlugin
        if (typeof ExtendModule === "function") {
          this.extensions.push(ExtendModule);
          console.log(`Loaded extension: ${resolvedPath}`);
        } else {
          console.error(
            `Invalid extension: ${resolvedPath} - must extension BaseExtend`,
          );
        }
      } catch (error) {
        console.error(`Error loading extension ${extensionPath}: ${error.message}`);
      }
    }

    // 将加载的扩展存储到全局变量
    globalVariable.extensions = this.extensions;
  }

  init() {
    const aiResultParser = this.aiCli.aiResultParser;
    const aiService = this.aiCli.aiService;
    const baseFunctionDescriptionArr = [];
    const baseFunction = aiResultParser.baseFunction;
    this.extensions.forEach((ExtendModule, index) => {
      // 实例化扩展
      const extensionInstance = new ExtendModule(this.aiCli);
      if (extensionInstance.getDescriptions) {
        const descriptions = extensionInstance.getDescriptions();
        if (descriptions) {
          descriptions.forEach((description) => {
            const newFuncName = `${description.name}_${index}`
            if (description.type === 'function' || !description.type) {
              baseFunction[newFuncName] = extensionInstance[description.name].bind(extensionInstance);
            } else {
              baseFunction[newFuncName] = extensionInstance[description.name];
            }
            const arrIndex = baseFunctionDescriptionArr.length;
            if (description.type === 'function') {
              if (description.params && description.params.length) {
                baseFunctionDescriptionArr.push(`${arrIndex + 1}. ${newFuncName}(${description.params.join(',')}) - ${description.description}`);
              } else {
                baseFunctionDescriptionArr.push(`${arrIndex + 1}. ${newFuncName}() - ${description.description}`);
              }
            } else {
              baseFunctionDescriptionArr.push(`${arrIndex + 1}. ${newFuncName} - ${description.description}`);
            }
          })
        }
      }
    });
    aiService.baseFunctionDescription = baseFunctionDescriptionArr.join('\n');
  }
}

module.exports = ExtensionManager;
