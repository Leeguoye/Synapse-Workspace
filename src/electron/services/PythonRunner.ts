import { spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

export class PythonRunner {
  /**
   * 執行一段 Python 腳本，並可透過 stdin 傳遞 JSON 參數
   */
  public static async execute(scriptContent: string, inputData: any = {}): Promise<{ success: boolean; result?: any; error?: string; logs: string[] }> {
    const tempDir = os.tmpdir();
    const scriptPath = path.join(tempDir, `synapse_run_${Date.now()}.py`);
    const logs: string[] = [];
    
    try {
      await fs.writeFile(scriptPath, scriptContent, 'utf8');

      // Helper to try spawning python
      const runPython = (command: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const proc = spawn(command, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
          let stdoutData = '';
          let stderrData = '';

          proc.stdout.on('data', (chunk) => {
            stdoutData += chunk.toString();
          });

          proc.stderr.on('data', (chunk) => {
            stderrData += chunk.toString();
            logs.push(`[STDERR] ${chunk.toString().trim()}`);
          });

          // Feed inputData into stdin if provided
          if (inputData) {
            proc.stdin.write(JSON.stringify(inputData));
          }
          proc.stdin.end();

          proc.on('close', (code) => {
            if (code === 0) {
              resolve(stdoutData);
            } else {
              reject(new Error(stderrData || `Python process exited with code ${code}`));
            }
          });
          
          proc.on('error', (err) => {
            reject(err);
          });
        });
      };

      let output = '';
      try {
        // 先嘗試 python3
        output = await runPython('python3');
      } catch (err3: any) {
        if (err3.code === 'ENOENT' || String(err3).includes('ENOENT')) {
          // 找不到 python3，嘗試 python
          try {
            output = await runPython('python');
          } catch (err: any) {
            throw new Error(`找不到有效的 Python 執行環境。請確認系統是否已安裝 Python。`);
          }
        } else {
          throw err3;
        }
      }

      // 將標準輸出最後一塊視為結果 (嘗試解析 JSON)
      const outLines = output.trim().split('\n');
      const lastLine = outLines.pop() || '';
      linesToLogs(outLines, logs);

      let result = null;
      try {
        result = JSON.parse(lastLine);
      } catch {
        // 如果最後一列不是 JSON，整體輸出視為結果字串
        result = output.trim();
      }

      return { success: true, result, logs };

    } catch (error: any) {
      return { success: false, error: error.message || String(error), logs };
    } finally {
      // 確保清理暫存檔
      try {
        await fs.unlink(scriptPath);
      } catch { /* ignore */ }
    }
  }
}

function linesToLogs(lines: string[], logs: string[]) {
  for (const line of lines) {
    if (line.trim()) logs.push(`[STDOUT] ${line.trim()}`);
  }
}
