// 修改成commonjs  
const fs = require('fs');
const path = require('path');
const DefaultPlugin = require('./DefaultPlugin');
const globalVariable = require('../GlobalVariable');

class PluginManager {
    constructor(aiCli) {
        this.aiCli = aiCli;
        this.plugins = [new DefaultPlugin(aiCli)];
        globalVariable.pluginManager = this;
    }

    // 解析并加载插件
    parsePlugin(configPlugins) {
        if (!Array.isArray(configPlugins)) {
            return;
        }

        for (const pluginPath of configPlugins) {
            try {
                // 解析插件路径
                const resolvedPath = path.isAbsolute(pluginPath) 
                    ? pluginPath 
                    : path.resolve(process.cwd(), pluginPath);

                if (!fs.existsSync(resolvedPath)) {
                    console.error(`Plugin file not found: ${resolvedPath}`);
                    continue;
                }

                // 动态加载插件模块
                const PluginModule = require(resolvedPath);

                // 检查插件是否继承自BasePlugin
                if (typeof PluginModule === 'function') {

                    // 实例化插件
                    const pluginInstance = new PluginModule(this.aiCli);
                    this.plugins.push(pluginInstance);
                    console.log(`Loaded plugin: ${resolvedPath}`);
                } else {
                    console.error(`Invalid plugin: ${resolvedPath} - must extend BasePlugin`);
                }
            } catch (error) {
                console.error(`Error loading plugin ${pluginPath}: ${error.message}`);
            }
        }

        // 将加载的插件存储到全局变量
        globalVariable.plugins = this.plugins;
    }

    // 初始化插件
    async onInitialize() {
        for (const plugin of this.plugins) {
            try {
                await plugin.onInitialize();
            } catch (error) {
                console.error(`Error in plugin initialization: ${error.message}`);
            }
        }
    }

    // AI请求前的钩子
    async onBeforeAIRequest(messages) {
        let result = messages;

        for (const plugin of this.plugins) {
            try {
                const pluginResult = await plugin.onBeforeAIRequest(result);
                if (pluginResult && typeof pluginResult === 'object') {
                    result = pluginResult;
                }
            } catch (error) {
                console.error(`Error in plugin onBeforeAIRequest: ${error.message}`);
            }
        }

        return result;
    }

    // AI请求后的钩子
    async onAfterAIRequest(rawData) {
        let result = rawData;

        for (const plugin of this.plugins) {
            try {
                const pluginResult = await plugin.onAfterAIRequest(result);
                if (pluginResult !== undefined) {
                    result = pluginResult;
                }
            } catch (error) {
                console.error(`Error in plugin onAfterAIRequest: ${error.message}`);
            }
        }

        return result;
    }

    // 解析完成后的钩子
    async onAfterParse(parsedData) {
        let result = parsedData;

        for (const plugin of this.plugins) {
            try {
                const pluginResult = await plugin.onAfterParse(result);
                if (pluginResult !== undefined) {
                    result = pluginResult;
                }
            } catch (error) {
                console.error(`Error in plugin onAfterParse: ${error.message}`);
            }
        }

        return result;
    }

    // 每一步执行前的钩子
    async onBeforeStep(steps, stepIndex, step) {
        let result = step;

        for (const plugin of this.plugins) {
            try {
                const pluginResult = await plugin.onBeforeStep(steps, stepIndex, result);
                if (pluginResult !== undefined) {
                    result = pluginResult;
                }
            } catch (error) {
                console.error(`Error in plugin onBeforeStep: ${error.message}`);
            }
        }

        return result;
    }

    // 每一步执行后的钩子
    async onAfterStep(steps, stepIndex, step, outputList) {
        for (const plugin of this.plugins) {
            try {
                await plugin.onAfterStep(steps, stepIndex, step, outputList);
            } catch (error) {
                console.error(`Error in plugin onAfterStep: ${error.message}`);
            }
        }
    }

    // 整个步骤执行完成的钩子
    async onAfterAllSteps(steps, outputList) {
        for (const plugin of this.plugins) {
            try {
                await plugin.onAfterAllSteps(steps, outputList);
            } catch (error) {
                console.error(`Error in plugin onAfterAllSteps: ${error.message}`);
            }
        }
    }
}

module.exports = PluginManager