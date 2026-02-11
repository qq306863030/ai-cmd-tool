
const BaseAIService = require('./BaseAIService');

class OllamaService extends BaseAIService {
  constructor() {
    super();
    this.type = 'ollama';
  }
}

module.exports = OllamaService;