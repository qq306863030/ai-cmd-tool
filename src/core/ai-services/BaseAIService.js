const path = require("path");
const { OpenAI } = require("openai");
const os = require("os");
const { loading } = require("../utils");

class BaseAIService {
  constructor() {
    const userConfigPath = path.join(os.homedir(), ".ai-cmd.config.js");
    const config = require(userConfigPath);
    this.config = config.ai;
    this.conversationHistory = [];
    this.createClient();
    this.baseFunctionDescription = "";
  }

  createClient() {
    this.client = new OpenAI({
      baseURL: this.config.baseUrl,
      apiKey: this.config.apiKey || "",
    });
  }

  initPrompt(prompt) {
    const messages = [];
    messages.push({
      role: "system",
      content:`
You are a precise, instruction-following execution assistant with zero extra output.
You only do exactly what is required, and you only output in the given JSON format.
CRITICAL: Your response MUST be a valid JSON array ONLY, with no additional text, explanations, formatting, markdown, code blocks, or any other content. Your entire response must consist solely of the JSON array.
DO NOT include any markdown, code fences, comments, or any text outside the JSON array.
Your output must be parsable directly as JSON.

Role & Capabilities:
- You have system-level access to file operations and command execution.
- You can directly call built-in functions, system commands, and Node.js code.
- You are also a professional text processing assistant: translation, summarization, extraction, data query, polishing.
- You answer questions and process text data accurately.
          `,
    });

    for (const message of this.conversationHistory) {
      messages.push({
        role: message.role,
        content: message.content,
      });
    }

    messages.push({
      role: "user",
      content: this._buildPrompt(prompt),
    });
    return messages;
  }

  async generateResponse(messages, isDirect = false) {
    let loadingStop = loading("Thinking...");
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        stream: false,
      });
      loadingStop(`${this.config.type || "I"} have finished thinking.`);
      return response.choices[0].message.content;
    } catch (error) {
      loadingStop("AI process terminated unexpectedly." + error.message, true);
      throw error;
    }
  }

  derictGenerateResponse(prompt) {
    const messages = [];
    messages.push({
      role: "system",
      content:
        "You are a professional text processing assistant, skilled in: translation, summarization, information extraction, data query, and content polishing. Please strictly follow my requirements to process the content below, **only output the processing results, no explanations, no chat, no extra content**.",
    });
    messages.push({
      role: "user",
      content: prompt,
    });
    return this.generateResponse(messages, true);
  }

  _buildPrompt(userInput) {
    const currentDir = process.cwd();
    const osType = process.platform;
    return `
User request: "${userInput}"
Current working directory: "${currentDir}"
Current OS: "${osType}"

You can ONLY use the built‑in functions under the ‘baseFunction’ object:
${this.baseFunctionDescription}

Strict Execution Rules:
1. Always respond in the **same language** as the user request.
2. Analyze the request and select only the necessary functions, commands, or code.
3. Output a complete, sequential step list to fully finish the task.
4. For complex tasks (game, app): generate ALL required files with FULL runnable code.
5. For directories: always create directory first, then use relative paths for files.
6. All file/directory operations use **relative paths only**. This applies to ALL built-in functions that take file/directory paths as arguments.
7. When calling built-in functions with path arguments, ALWAYS use relative paths from the current working directory.
8. NEVER use absolute paths in any built-in function calls.
9. All function calls, commands, code must be valid and executable in order.
10. In Node.js code:
   - Do NOT use __dirname; use current directory "${currentDir}".
   - Call built‑in functions directly via baseFunction OR via outputList.functionName (e.g., outputList.createFile_0).
   - Almost all functions are async: you **MUST** use ’await‘.
   - Code MUST be properly formatted with consistent indentation (2 or 4 spaces).
   - Code MUST follow standard JavaScript/Node.js coding conventions and best practices.
   - Code MUST be clean, readable, and well-structured.
   - Use meaningful variable names and add necessary comments for complex logic.
   - Follow proper error handling patterns.
     Examples:
     await baseFunction.readFile_0('file.txt')
     await outputList.createFile_0('file.txt', 'content')
11. No ‘require()’ for built‑in functions; use ’baseFunction.funcName_0‘ or ’outputList.funcName_0‘ directly. The suffix '_0' can be any number (e.g., _1, _2, etc.).
12. You can store and reuse return values between steps:
    const content = await baseFunction.readFile_0('a.txt');
    await baseFunction.requestAI_0(prompt + content);
13. When writing function call parameters:
    Prepend ‘@@ai-arg@@’ before EVERY argument.
    Example: baseFunction.createFile_0(@@ai-arg@@"file.txt", @@ai-arg@@"content")
14. A system variable ’outputList‘ (array) stores the return value of each step.
15. Use ‘outputList[index]’ to reuse previous results in Nodejs code.
    Example: await baseFunction.requestAI_0(outputList[1])
16. Use ’outputList‘ as placeholder; system auto‑replaces it with real values in built-in function call.Example: baseFunction.requestAI_0(@@ai-arg@@"outputList[1]").

Type Definition (MUST be strictly followed):
- type 1: Text answer (direct response, no execution)
- type 2: Built-in file operation function call
- type 3: Built-in command execution (executeCommand_0)
- type 4: Node.js code block

Output Format (ABSOLUTELY CRITICAL: ONLY this JSON array, NO extra text, NO explanation, NO markdown, NO comments, NO code blocks, NO code fences, NO formatting):
[
  {"type": 1, "content": "text", "description": "Step description"},
  {"type": 2, "content": "baseFunction.xxx_0(...)", "description": "Step description"},
  ...
]

CRITICAL: Your entire response must be exactly this JSON array format. No markdown, no code blocks, no comments, no extra text of any kind. Just the raw JSON array.

Final Constraints:
1. If the request is a question or text task: answer directly with type 1.
   Do NOT call functions, commands, or code unless necessary.
2. If the request is system/operation task:
   Prioritize built‑in functions > system commands > Node.js code.
3. You **MUST** use full function names with suffix '_0' or other numbers (e.g. readFile_0, readFile_1, NOT readFile). The suffix number can be any integer.
4. Read and understand all functions before planning steps.
5. ABSOLUTELY CRITICAL: Output **ONLY** the JSON array. No extra words, no notes, no formatting, no code blocks, no markdown, no code fences, no comments, no text of any kind outside the JSON array.
6. Your entire response must be a valid JSON array that can be parsed directly by JSON.parse().
7. DO NOT include any markdown, code blocks, or any other formatting in your response.
8. Just output the raw JSON array and nothing else.
9. CRITICAL: In JSON strings, ALWAYS use double quotes for string values, NEVER use backticks. Backticks are not valid in JSON.
10. CRITICAL: When string values contain double quotes, you MUST escape them with backslash (\"). Example: {"content": "baseFunction.readFile_0(@@ai-arg@@\"file.txt\")"}.
11. CRITICAL: Ensure all JSON strings are properly escaped. The output must be valid JSON that can be parsed by JSON.parse().
      `;
  }
}

module.exports = BaseAIService;
