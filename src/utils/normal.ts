import { logError } from "./print";
import { exec, spawn } from 'child_process';

/**
 * 检查某个命令是否可用（在 PATH 中可找到）。
 * 用于在无桌面环境的 Linux 服务器上判断 xdg-open 等 GUI 工具是否存在。
 */
function isCommandAvailable(command: string): boolean {
  try {
    const { execSync } = require('child_process');
    execSync(`command -v ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 在无桌面环境的 Linux 上选择一个可用的终端编辑器。
 * 优先使用用户可能更熟悉的编辑器，找不到则回退到 vi。
 */
function pickTerminalEditor(): string {
  const candidates = ['vim', 'vi', 'nano'];
  for (const editor of candidates) {
    if (isCommandAvailable(editor)) {
      return editor;
    }
  }
  return 'vi';
}

export function editFile(filePath: string) {
  const platform = process.platform;
  let openCommand;
  if (platform === 'darwin') {
    openCommand = `open -e "${filePath}"`;
  } else if (platform === 'win32') {
    openCommand = `notepad "${filePath}"`;
  } else if (isCommandAvailable('xdg-open')) {
    // 有桌面环境时用 xdg-open
    openCommand = `xdg-open "${filePath}"`;
  } else {
    // 无桌面环境（如纯命令行 CentOS 服务器），回退到终端编辑器
    const editor = pickTerminalEditor();
    openCommand = `${editor} "${filePath}"`;
  }
  exec(openCommand, (error) => {
    if (error) {
      logError('Error opening configuration file:' + error.message);
    }
  });
}

export function openDirectory(dirPath: string) {
  const platform = process.platform;
  let command: string;
  let args: string[];

  if (platform === 'darwin') {
    command = 'open';
    args = [dirPath];
  } else if (platform === 'win32') {
    command = 'explorer.exe';
    args = [dirPath];
  } else if (isCommandAvailable('xdg-open')) {
    // 有桌面环境时用 xdg-open
    command = 'xdg-open';
    args = [dirPath];
  } else {
    // 无桌面环境时无法“打开”目录，回退为列出目录内容
    console.log(`No desktop environment, listing directory contents: ${dirPath}`);
    command = 'ls';
    args = ['-la', dirPath];
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.on('error', (error) => {
    console.error(`Error opening directory "${dirPath}": ${error.message}`);
  });
  child.unref();
}

export function getTrueCwd() {
  return process.cwd();
}