function DefaultConfig() {
  return {
    ai: {
      type: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-reasoner",
      apiKey: "",
      temperature: 1,
      maxTokens: 8192,
      stream: true,
    },
    outputAiResult: false,
    plugins: [],
    extensions: [],
    file: {
      encoding: "utf8",
    },
  };
}

module.exports = DefaultConfig();
