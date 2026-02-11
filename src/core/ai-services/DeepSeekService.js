
const BaseAIService = require('./BaseAIService');

class DeepSeekService extends BaseAIService {
  constructor() {
    super();
    this.type = 'deepseek';
  }
}

module.exports = DeepSeekService;