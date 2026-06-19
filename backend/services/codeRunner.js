const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 12000;
const MAX_CODE_LENGTH = 160000;
const MAX_STDIN_LENGTH = 20000;
const MAX_OUTPUT_LENGTH = 120000;

function createRunError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}

function normalizeLanguage(value = '') {
  const language = String(value || '').trim().toLowerCase();
  const aliases = {
    py: 'python',
    python3: 'python',
    js: 'javascript',
    node: 'javascript',
    mjs: 'javascript',
    cxx: 'cpp',
    'c++': 'cpp',
    cc: 'cpp',
    cs: 'csharp',
    'c#': 'csharp'
  };

  return aliases[language] || language || 'text';
}

function getRuntime(language, code, workDir) {
  const normalized = normalizeLanguage(language);

  if (normalized === 'python') {
    return {
      language: normalized,
      fileName: 'main.py',
      command: process.env.PYTHON_BIN || 'python',
      args: ['main.py'],
      code
    };
  }

  if (normalized === 'javascript') {
    return {
      language: normalized,
      fileName: 'main.js',
      command: process.env.NODE_BIN || process.execPath,
      args: ['main.js'],
      code
    };
  }

  if (normalized === 'java') {
    const className = findJavaClassName(code);
    return {
      language: normalized,
      fileName: `${className}.java`,
      compile: {
        command: process.env.JAVAC_BIN || 'javac',
        args: [`${className}.java`]
      },
      command: process.env.JAVA_BIN || 'java',
      args: ['-cp', workDir, className],
      code
    };
  }

  if (normalized === 'c') {
    return {
      language: normalized,
      fileName: 'main.c',
      compile: {
        command: process.env.CC_BIN || 'gcc',
        args: ['main.c', '-o', executablePath(workDir, 'main')]
      },
      command: executablePath(workDir, 'main'),
      args: [],
      code
    };
  }

  if (normalized === 'cpp') {
    return {
      language: normalized,
      fileName: 'main.cpp',
      compile: {
        command: process.env.CXX_BIN || 'g++',
        args: ['main.cpp', '-std=c++17', '-o', executablePath(workDir, 'main')]
      },
      command: executablePath(workDir, 'main'),
      args: [],
      code
    };
  }

  throw createRunError(400, `Running ${language || 'this language'} is not supported yet.`);
}

function executablePath(workDir, name) {
  return path.join(workDir, process.platform === 'win32' ? `${name}.exe` : name);
}

function findJavaClassName(code) {
  const publicMatch = /\bpublic\s+class\s+([A-Za-z_$][\w$]*)/.exec(code);
  const classMatch = /\bclass\s+([A-Za-z_$][\w$]*)/.exec(code);
  return publicMatch?.[1] || classMatch?.[1] || 'Main';
}

function trimOutput(value = '') {
  const text = String(value || '');
  return text.length > MAX_OUTPUT_LENGTH ? `${text.slice(0, MAX_OUTPUT_LENGTH)}\n[output truncated]` : text;
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, options.timeoutMs || DEFAULT_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout = trimOutput(`${stdout}${chunk.toString()}`);
    });

    child.stderr.on('data', (chunk) => {
      stderr = trimOutput(`${stderr}${chunk.toString()}`);
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      resolve({
        exitCode: null,
        stdout: '',
        stderr: `${command} is not available: ${error.message}`,
        timedOut: false,
        durationMs: Date.now() - startedAt
      });
    });

    child.on('close', (exitCode) => {
      clearTimeout(timeoutId);
      resolve({
        exitCode,
        stdout: trimOutput(stdout),
        stderr: trimOutput(stderr),
        timedOut,
        durationMs: Date.now() - startedAt
      });
    });

    if (options.stdin) {
      child.stdin.write(options.stdin);
    }

    child.stdin.end();
  });
}

async function runCode({ code, language, stdin = '', timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const source = String(code || '');
  const input = String(stdin || '');

  if (!source.trim()) {
    throw createRunError(400, 'Code is required.');
  }

  if (source.length > MAX_CODE_LENGTH) {
    throw createRunError(413, `Code is too large. Limit is ${MAX_CODE_LENGTH} characters.`);
  }

  if (input.length > MAX_STDIN_LENGTH) {
    throw createRunError(413, `Input is too large. Limit is ${MAX_STDIN_LENGTH} characters.`);
  }

  const safeTimeout = Number.isInteger(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 30000) : DEFAULT_TIMEOUT_MS;
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `kyrovia-code-${randomUUID()}-`));

  try {
    const runtime = getRuntime(language, source, workDir);
    await fs.writeFile(path.join(workDir, runtime.fileName), runtime.code, 'utf8');

    let compileResult = null;
    if (runtime.compile) {
      compileResult = await runProcess(runtime.compile.command, runtime.compile.args, {
        cwd: workDir,
        timeoutMs: safeTimeout
      });

      if (compileResult.exitCode !== 0 || compileResult.timedOut) {
        return {
          language: runtime.language,
          phase: 'compile',
          exitCode: compileResult.exitCode,
          stdout: compileResult.stdout,
          stderr: compileResult.stderr,
          timedOut: compileResult.timedOut,
          durationMs: compileResult.durationMs
        };
      }
    }

    const runResult = await runProcess(runtime.command, runtime.args, {
      cwd: workDir,
      stdin: input,
      timeoutMs: safeTimeout
    });

    return {
      language: runtime.language,
      phase: 'run',
      exitCode: runResult.exitCode,
      stdout: runResult.stdout,
      stderr: runResult.stderr,
      timedOut: runResult.timedOut,
      durationMs: runResult.durationMs,
      compile: compileResult
        ? {
            stdout: compileResult.stdout,
            stderr: compileResult.stderr,
            durationMs: compileResult.durationMs
          }
        : null
    };
  } finally {
    await fs.rm(workDir, { force: true, recursive: true }).catch(() => undefined);
  }
}

module.exports = {
  runCode
};
