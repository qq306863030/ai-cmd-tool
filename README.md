# AI Command Tool

An AI command-line tool that processes operating system commands and manipulates files through natural language processing, supporting Ollama, DeepSeek, and OpenAI.

## Language

- [English](README.md) | [中文](README_CN.md)

## Screenshot

![AI Command Tool Screenshot](https://raw.githubusercontent.com/qq306863030/ai-cmd-tool/main/screenshot/2.png)

## Repository

[GitHub: qq306863030/ai-cmd-tool](https://github.com/qq306863030/ai-cmd-tool)

## Installation

### Prerequisites

- Node.js (v22.14.0 or higher)
- npm or yarn

### Install via npm

```bash
npm install -g ai-cmd-tool
```

### Install from source

```bash
git clone https://github.com/qq306863030/ai-cmd-tool.git
cd ai-cmd-tool
npm install
npm link
```

## Configuration

### Initial Setup

Run the configuration wizard to set up your AI service:

```bash
ai config setup
```

This will prompt you to configure:

- **AI Service Type**: Choose from Ollama, DeepSeek, or OpenAI
- **API Base URL**: Default URLs provided for each service
- **Model Name**: Select the AI model to use
- **API Key**: Required for DeepSeek and OpenAI
- **Temperature**: Control response randomness (0-2)
- **Max Tokens**: Maximum response length
- **Streaming Output**: Enable/disable streaming responses

### Configuration File Structure

The configuration file (`~/.ai-cmd.config.js`) has the following structure:

```javascript
module.exports = {
  ai: {
    type: "deepseek", // AI service type: "ollama", "deepseek", or "openai"
    baseUrl: "https://api.deepseek.com", // API base URL
    model: "deepseek-reasoner", // AI model name
    apiKey: "", // API key (required for DeepSeek and OpenAI)
    temperature: 1, // Response randomness (0-2)
    maxTokens: 8192, // Maximum response length
    stream: true, // Enable/disable streaming output
  },
  outputAiResult: false, // Whether to output AI result
  plugins: [], // List of plugin file paths
  extensions: [], // List of extension file paths
  file: {
    encoding: "utf8", // File encoding
  },
};
```

### Configuration Commands

View current configuration:

```bash
ai config view
```

Edit configuration file:

```bash
ai config edit
```

Reset configuration:

```bash
ai config reset
```

Clear configuration:

```bash
ai config clear
```

## Usage

### Interactive Mode

Start an interactive session (multi-turn conversation):

```bash
ai
```

Or explicitly:

```bash
ai -i or ai -interactive
```


### Direct Command Mode

Execute a single command:

```bash
ai "create a new file named hello.txt with content 'Hello World'"
```

### Examples

**File Operations:**

```bash
ai "Create 10 text documents and input 100 random texts respectively"
ai "Clear the current directory"
```

**Code Generation:**

```bash
ai "Create a simple Express server with a /hello endpoint"
ai "Create a browser-based plane shooting game"
```

**System Commands:**

```bash
ai "List all files in the current directory with their sizes"
ai "Check the disk usage of the current directory"
```

**Media Processing:**

```bash
ai "I have ffmpeg5 installed on my system, help me convert all MP4 files in the directory to AVI format"
```

**File Organization:**

```bash
ai "Organize all files in the model directory by month into the model2 directory, date format is YYYY-MM"
```

## Recommendations

### AI Service Selection

**Recommendation: Use online AI services (DeepSeek/OpenAI) for best results**

While local AI services like Ollama provide privacy and offline capabilities, they may have limitations in:

- **Response accuracy**: Local models may not be as rigorous or precise as online models
- **Code quality**: Generated code may require more manual review and correction
- **Complex task handling**: May struggle with multi-step or complex operations
- **Language understanding**: Better language models are available through online services

For production use or complex tasks, we recommend using DeepSeek or OpenAI services for more reliable and accurate results.

## Plugin Development

### Creating a Plugin

Plugins allow you to hook into the execution lifecycle and add custom behavior.

#### Plugin Lifecycle Hooks

```javascript
const { BasePlugin } = require('ai-cmd-tool');

class MyPlugin extends BasePlugin {
  constructor(aiCli) {
    super(aiCli);
  }

  // Called when plugin is initialized
  async onInitialize() {
    console.log('MyPlugin initialized');
  }

  // Called before AI request, can modify messages
  async onBeforeAIRequest(messages) {
    console.log('Before AI request');
    return messages;
  }

  // Called after AI response, can modify raw data
  async onAfterAIRequest(rawData) {
    console.log('After AI request');
    return rawData;
  }

  // Called after response is parsed, can modify steps
  async onAfterParse(steps) {
    console.log('After parse');
    return steps;
  }

  // Called before each step execution, can modify step
  async onBeforeStep(steps, stepIndex, step) {
    console.log(`Before step ${stepIndex}`);
    return step;
  }

  // Called after each step execution
  async onAfterStep(steps, stepIndex, step, outputList) {
    console.log(`After step ${stepIndex}`);
  }

  // Called after all steps are executed
  async onAfterAllSteps(steps, outputList) {
    console.log('All steps completed');
  }
}

module.exports = MyPlugin;
```

#### Registering a Plugin

1. Save your plugin to a file (e.g., `my-plugin.js`)
2. Add it to your configuration:

```javascript
module.exports = {
  // ... other config
  plugins: [
    '/path/to/my-plugin.js'
  ],
};
```

### Example Plugin: Logging Plugin

```javascript
const { BasePlugin } = require('ai-cmd-tool');

class LoggingPlugin extends BasePlugin {
  async onBeforeAIRequest(messages) {
    console.log('AI Request:', JSON.stringify(messages, null, 2));
    return messages;
  }

  async onAfterAIRequest(rawData) {
    console.log('AI Response:', rawData);
    return rawData;
  }

  async onAfterStep(steps, stepIndex, step, outputList) {
    console.log(`Step ${stepIndex} completed:`, step.type);
  }
}

module.exports = LoggingPlugin;
```

## Extension Development

Extensions allow you to add custom functions that the AI can use.

### Creating an Extension

```javascript
const { BaseExtension } = require('ai-cmd-tool');

class MyExtension extends BaseExtension {
  // Define your custom functions here
  async myCustomFunction(param1, param2) {
    // Your implementation
    return 'result';
  }

  // Describe your functions for the AI
  getDescriptions() {
    return [
      {
        name: 'myCustomFunction',
        type: 'function',
        params: ['param1', 'param2'],
        description: 'Description of what this function does',
      },
    ];
  }
}

module.exports = MyExtension;
```

#### Registering an Extension

1. Save your extension to a file (e.g., `my-extension.js`)
2. Add it to your configuration:

```javascript
module.exports = {
  // ... other config
  extensions: [
    '/path/to/my-extension.js'
  ],
};
```

### Example Extension: Weather Extension

```javascript
const { BaseExtension } = require('ai-cmd-tool');

class WeatherExtension extends BaseExtension {
  async getWeather(city) {
    // Implement weather API call
    return `Weather in ${city}: 25°C, Sunny`;
  }

  getDescriptions() {
    return [
      {
        name: 'getWeather',
        type: 'function',
        params: ['city'],
        description: 'Get current weather information for a city',
      },
    ];
  }
}

module.exports = WeatherExtension;
```

## Advanced Usage

### Using Relative Paths

The AI always uses relative paths from the current working directory. This ensures portability across different systems.

## Troubleshooting

### Configuration Issues

If you encounter configuration errors, try resetting:

```bash
ai config reset
```

### AI Service Connection

- **Ollama**: Ensure Ollama is running locally on port 11434
- **DeepSeek/OpenAI**: Verify your API key is correct and you have sufficient credits

### Plugin/Extension Not Loading

- Check the file path in your configuration
- Ensure the file exports the correct class
- Verify the file has no syntax errors

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions, please open an issue on the GitHub repository.

