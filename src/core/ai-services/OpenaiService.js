const BaseAIService = require('./BaseAIService');

class OpenaiService extends BaseAIService {
  constructor() {
    super();
    this.type = 'openai';
  }
}

module.exports = OpenaiService;