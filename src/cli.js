#!/usr/bin/env node
const { program } = require("commander");
const inquirer = require("inquirer");
const fs = require("fs");
const path = require("path");
const os = require("os");
const AICLI = require("./core/AICLI");
const { logError } = require("./core/utils");
const userConfigPath = path.join(os.homedir(), ".ai-cmd.config.js");

async function handleMissingConfig() {
  console.log("\x1b[91mConfiguration file not initialized\x1b[0m");

  const { createConfig } = await inquirer.default.prompt([
    {
      type: "confirm",
      name: "createConfig",
      message: "Would you like to create a configuration file now?",
      default: true,
    },
  ]);

  if (createConfig) {
    await runSetupCommand();
  }
}

async function runSetupCommand() {
  console.log("AI Service Configuration");
  console.log("=".repeat(50));

  let currentConfig = {};
  if (fs.existsSync(userConfigPath)) {
    try {
      currentConfig = require(userConfigPath);
    } catch (error) {
      console.log(
        "Warning: Could not load existing configuration:",
        error.message,
      );
    }
  }

  const questions = [
    {
      type: "list",
      name: "type",
      message: "Select AI service type:",
      choices: [
        { name: "Ollama (Local)", value: "ollama" },
        { name: "DeepSeek (Online)", value: "deepseek" },
        { name: "OpenAI (Online)", value: "openai" },
      ],
      default: currentConfig.ai?.type || "ollama",
    },
    {
      type: "input",
      name: "otherType",
      message: "Enter custom AI service type:",
      when: (answers) => answers.type === "other",
      default: currentConfig.ai?.type || "custom",
    },
    {
      type: "input",
      name: "baseUrl",
      message: "Enter API base URL:",
      when: (answers) => answers.type !== "other",
      default: (answers) => {
        switch (answers.type) {
          case "ollama":
            return "http://localhost:11434/v1";
          case "deepseek":
            return "https://api.deepseek.com";
          case "openai":
            return "https://api.openai.com/v1";
          default:
            return currentConfig.ai?.baseUrl || "";
        }
      },
    },
    {
      type: "input",
      name: "otherBaseUrl",
      message: "Enter API base URL:",
      when: (answers) => answers.type === "other",
      default: currentConfig.ai?.baseUrl || "",
    },
    {
      type: "input",
      name: "model",
      message: "Enter model name:",
      when: (answers) => answers.type !== "other",
      default: (answers) => {
        switch (answers.type) {
          case "ollama":
            return "deepseek-coder-v2:16b";
          case "deepseek":
            return "deepseek-reasoner";
          case "openai":
            return "gpt-4";
          default:
            return currentConfig.ai?.model || "";
        }
      },
    },
    {
      type: "input",
      name: "otherModel",
      message: "Enter model name:",
      when: (answers) => answers.type === "other",
      default: currentConfig.ai?.model || "",
    },
    {
      type: "input",
      name: "apiKey",
      message: "Enter API key:",
      when: (answers) =>
        answers.type === "deepseek" || answers.type === "openai",
      default: "",
    },
    {
      type: "input",
      name: "otherApiKey",
      message: "Enter API key:",
      when: (answers) => answers.type === "other",
      default: currentConfig.ai?.apiKey || "",
    },
    {
      type: "number",
      name: "temperature",
      message: "Enter temperature (0-2):",
      default: 1,
      validate: (value) =>
        (value >= 0 && value <= 2) || "Temperature must be between 0 and 2",
    },
    {
      type: "number",
      name: "maxTokens",
      message: "Enter max tokens:",
      default: 8192,
      validate: (value) => value > 0 || "Max tokens must be greater than 0",
    },
    {
      type: "confirm",
      name: "stream",
      message: "Enable streaming output:",
      default: true,
    },
  ];

  const answers = await inquirer.default.prompt(questions);
  const defaultConfig = require("./core/DefaultConfig");
  defaultConfig.ai.type = answers.type === "other" ? answers.otherType : answers.type;
  defaultConfig.ai.baseUrl = answers.type === "other" ? answers.otherBaseUrl : answers.baseUrl;
  defaultConfig.ai.model = answers.type === "other" ? answers.otherModel : answers.model;
  defaultConfig.ai.apiKey = answers.type === "ollama" ? 'ollama' : answers.apiKey;
  defaultConfig.ai.temperature = answers.temperature;
  defaultConfig.ai.maxTokens = answers.maxTokens;
  defaultConfig.ai.stream = answers.stream;
  const newConfig = defaultConfig;
  const configContent = `module.exports = ${JSON.stringify(newConfig, null, 2)}`;

  fs.writeFileSync(userConfigPath, configContent);

  console.log("\nConfiguration saved successfully to:", userConfigPath);
  console.log("=".repeat(50));
  console.log("Current configuration:");
  console.log(`AI Service Type: ${newConfig.ai.type}`);
  console.log(`API Base URL: ${newConfig.ai.baseUrl}`);
  console.log(`Model: ${newConfig.ai.model}`);
  if (newConfig.ai.apiKey) {
    console.log(`API Key: ${newConfig.ai.apiKey.substring(0, 8)}...`);
  }
  console.log(`Temperature: ${newConfig.ai.temperature}`);
  console.log(`Max Tokens: ${newConfig.ai.maxTokens}`);
  console.log(`Streaming Output: ${newConfig.ai.stream ? 'Enabled' : 'Disabled'}`);
  console.log("=".repeat(50));
}

program
  .version("1.0.0")
  .description(
    "A command-line tool that uses AI to execute commands and manipulate files",
  )
  .option("-p, --prompt <prompt>", "The prompt to send to the AI")
  .option("-i, --interactive", "Start interactive mode")
  .arguments("[prompt...]")
  .action((prompt) => {
    program.prompt = Array.isArray(prompt) ? prompt.join(" ") : prompt || "";
  });

const configCommand = program
  .command("config")
  .description("Configure AI service settings");

configCommand
  .command("view")
  .description("View current AI configuration")
  .action(async () => {
    if (!fs.existsSync(userConfigPath)) {
      await handleMissingConfig();
      return;
    }

    try {
      const currentConfig = require(userConfigPath);
      console.log("Current AI Configuration");
      console.log("=".repeat(50));
      console.log(`AI Service Type: ${currentConfig.ai.type}`);
      console.log(`API Base URL: ${currentConfig.ai.baseUrl}`);
      console.log(`Model: ${currentConfig.ai.model}`);
      if (currentConfig.ai.apiKey) {
        console.log(`API Key: ${currentConfig.ai.apiKey.substring(0, 8)}...`);
      }
      console.log(`Temperature: ${currentConfig.ai.temperature}`);
      console.log(`Max Tokens: ${currentConfig.ai.maxTokens}`);
      console.log(`Streaming Output: ${currentConfig.ai.stream ? 'Enabled' : 'Disabled'}`);
      console.log(`File Encoding: ${currentConfig.file.encoding}`);
      console.log("=".repeat(50));
      console.log(`Configuration file location: ${userConfigPath}`);
    } catch (error) {
      console.log("Error loading configuration:", error.message);
    }
  });

configCommand
  .command("edit")
  .description("Edit configuration file with notepad")
  .action(async () => {
    if (!fs.existsSync(userConfigPath)) {
      await handleMissingConfig();
      return;
    }

    const { exec } = require("child_process");
    exec(`notepad "${userConfigPath}"`, (error) => {
      if (error) {
        console.log("Error opening configuration file:", error.message);
      }
    });
  });

configCommand
  .command("clear")
  .description("Delete the configuration file")
  .action(async () => {
    if (!fs.existsSync(userConfigPath)) {
      console.log("Configuration file does not exist");
      return;
    }

    const { confirm } = await inquirer.default.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "Are you sure you want to delete the configuration file?",
        default: false,
      },
    ]);

    if (confirm) {
      fs.unlinkSync(userConfigPath);
      console.log("Configuration file deleted successfully:", userConfigPath);
    } else {
      console.log("Operation cancelled");
    }
  });

configCommand
  .command("setup")
  .description("Configure AI service settings interactively")
  .action(async () => {
    await runSetupCommand();
  });

configCommand
  .command("reset")
  .description("Reset configuration file")
  .action(async () => {
    if (fs.existsSync(userConfigPath)) {
      const { confirm } = await inquirer.default.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: "Are you sure you want to reset the configuration file?",
          default: false,
        },
      ]);

      if (confirm) {
        console.log("Resetting configuration file:", userConfigPath);
        await runSetupCommand();
      } else {
        console.log("Operation cancelled");
        process.exit(0);
      }
    } else {
      await runSetupCommand();
    }
  });

async function main() {
  try {
    if (program.args && program.args[0] === "config") {
      return;
    }

    const options = program.opts();
    let prompt;

    if (program.prompt) {
      prompt = program.prompt;
    } else if (options.prompt) {
      prompt = options.prompt;
    } else if (!program.args || program.args.length === 0) {
      options.interactive = true;
    } else {
      prompt = program.args.join(" ");
    }
    if (!fs.existsSync(userConfigPath)) {
      await handleMissingConfig();
      return;
    }
    const config = require(userConfigPath);
    const cli = new AICLI(config);
    if (options.interactive) {
      cli.startInteractive();
      return;
    }

    if (prompt) {
      cli.run(prompt);
    }
  } catch (error) {
    logError(error.stack);
  }
}

program.parse(process.argv);

main();
