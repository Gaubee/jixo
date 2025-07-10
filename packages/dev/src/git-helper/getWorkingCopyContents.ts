import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'child_process';

/**
 * 定义返回结果中每个文件对象的结构。
 */
export interface FileContentResult {
  /** 文件的仓库相对路径 */
  path: string;
  /** 文件内容的字符串形式。如果文件未找到或发生错误，则为 null。 */
  content: string | null;
  /** 如果有错误，则包含错误信息。 */
  error?: string;
}

/**
 * 高效获取工作区或暂存区中多个文件的完整内容。
 *
 * @param repoPath git 仓库的绝对或相对路径。
 * @param filePaths 要获取内容的文件路径数组，路径相对于仓库根目录。
 * @param options (可选) 配置对象。
 * @param options.staged (可选) 如果为 true，则从暂存区(staged)获取内容；否则从文件系统(工作区)直接读取。默认为 false。
 * @returns 一个 Promise，它解析为一个包含文件内容结果的数组。
 */
export async function getWorkingCopyContents(
  repoPath: string,
  filePaths: string[],
  options: {
    staged?: boolean;
  } = {}
): Promise<FileContentResult[]> {
  if (!filePaths || filePaths.length === 0) {
    return [];
  }

  // 根据选项选择不同的实现策略
  if (options.staged) {
    // 从暂存区读取内容，使用高效的 `git cat-file --batch`
    return getStagedFileContents(repoPath, filePaths);
  } else {
    // 从文件系统（工作区）读取内容，使用高效的 `fs.readFile`
    return getWorkspaceFileContents(repoPath, filePaths);
  }
}

/**
 * 内部辅助函数：从文件系统读取多个文件。
 */
async function getWorkspaceFileContents(
  repoPath: string,
  filePaths: string[]
): Promise<FileContentResult[]> {
  const promises = filePaths.map(async (filePath): Promise<FileContentResult> => {
    try {
      // 构建文件的绝对路径
      const absolutePath = path.resolve(repoPath, filePath);
      const content = await fs.readFile(absolutePath, 'utf-8');
      return { path: filePath, content, error: undefined };
    } catch (err: any) {
      // 处理文件不存在或无法读取的错误
      let errorMessage = `Failed to read file: ${filePath}`;
      if (err.code === 'ENOENT') {
        errorMessage = `File not found in workspace: ${filePath}`;
      }
      return { path: filePath, content: null, error: errorMessage };
    }
  });

  return Promise.all(promises);
}

/**
 * 内部辅助函数：使用 `git cat-file --batch` 从暂存区读取多个文件。
 * 注意：这里的实现与之前的 `getMultipleFileContents` 非常相似，但查询的是暂存区对象。
 */
function getStagedFileContents(
  repoPath: string,
  filePaths: string[]
): Promise<FileContentResult[]> {
  return new Promise((resolve, reject) => {
    const results = new Map<string, FileContentResult>();
    filePaths.forEach(p => results.set(p, { path: p, content: null, error: 'File was not processed.' }));

    const expectedContentQueue = [...filePaths];

    // 使用 `:filepath` 语法来查询暂存区对象
    const gitProcess = spawn('git', ['-C', repoPath, 'cat-file', '--batch']);

    let stdoutBuffer = Buffer.alloc(0);

    gitProcess.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);

      while (true) {
        const newlineIndex = stdoutBuffer.indexOf('\n');
        if (newlineIndex === -1) break;

        const header = stdoutBuffer.toString('utf8', 0, newlineIndex);
        const ref = header.split(' ')[0];
        
        // 暂存区中不存在的文件会报告 "missing"
        if (header.endsWith(' missing')) {
          const missingPath = ref.substring(1); // 从 ":path" 中提取 "path"
          if (results.has(missingPath)) {
            results.get(missingPath)!.error = `File not found in stage (index): ${missingPath}`;
          }
          const index = expectedContentQueue.indexOf(missingPath);
          if (index > -1) expectedContentQueue.splice(index, 1);
          stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
          continue;
        }

        const sizeStr = header.split(' ')[2];
        const size = parseInt(sizeStr, 10);
        if (isNaN(size)) break;
        
        const recordLength = newlineIndex + 1 + size + 1;
        if (stdoutBuffer.length < recordLength) break;
        
        const contentBuffer = stdoutBuffer.slice(newlineIndex + 1, newlineIndex + 1 + size);
        const currentPath = expectedContentQueue.shift();
        
        if (currentPath && results.has(currentPath)) {
          const result = results.get(currentPath)!;
          result.content = contentBuffer.toString('utf8');
          result.error = undefined;
        }

        stdoutBuffer = stdoutBuffer.slice(recordLength);
      }
    });
    
    gitProcess.on('error', reject);
    gitProcess.stderr.on('data', (data) => console.error(`git cat-file stderr: ${data}`));
    
    gitProcess.on('close', code => {
      if (code !== 0 && Array.from(results.values()).every(r => r.content === null)) {
        reject(new Error(`git cat-file process exited with code ${code}`));
      } else {
        resolve(Array.from(results.values()));
      }
    });

    for (const filePath of filePaths) {
      gitProcess.stdin.write(`:${filePath}\n`); // 注意查询暂存区的语法
    }
    gitProcess.stdin.end();
  });
}


// --- 示例用法 ---
/*
import { getWorkingCopyContents } from './getWorkingCopyContents';
import path from 'path';
import fs from 'fs';

async function setupAndRun() {
  const repoPath = path.resolve(__dirname, '../test-repo-working-copy');
  
  // 创建一个干净的测试环境
  if (fs.existsSync(repoPath)) fs.rmSync(repoPath, { recursive: true, force: true });
  fs.mkdirSync(repoPath);
  spawn('git', ['init'], { cwd: repoPath }).on('close', () => {
    fs.writeFileSync(path.join(repoPath, 'file_both.txt'), 'initial\n');
    fs.writeFileSync(path.join(repoPath, 'file_staged_only.txt'), 'staged\n');
    spawn('git', ['add', '.'], { cwd: repoPath }).on('close', () => {
      fs.appendFileSync(path.join(repoPath, 'file_both.txt'), 'unstaged change\n');
      fs.writeFileSync(path.join(repoPath, 'file_unstaged_only.txt'), 'unstaged\n');
      
      mainTest(repoPath);
    });
  });
}

async function mainTest(repoPath: string) {
    const filesToGet = [
        'file_both.txt', 
        'file_staged_only.txt', 
        'file_unstaged_only.txt',
        'non-existent-file.txt'
    ];
    
    console.log('--- 1. Getting WORKSPACE (unstaged) contents ---');
    const workspaceContents = await getWorkingCopyContents(repoPath, filesToGet);
    workspaceContents.forEach(r => {
        console.log(`[File]: ${r.path}`);
        r.error ? console.log(`  Error: ${r.error}`) : console.log(`  Content:\n---\n${r.content}\n---`);
    });

    console.log('\n--- 2. Getting STAGED contents ---');
    const stagedContents = await getWorkingCopyContents(repoPath, filesToGet, { staged: true });
    stagedContents.forEach(r => {
        console.log(`[File]: ${r.path}`);
        r.error ? console.log(`  Error: ${r.error}`) : console.log(`  Content:\n---\n${r.content}\n---`);
    });
}

setupAndRun();
*/