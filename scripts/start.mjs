import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareBackend, startBackend } from './backend.mjs';
import { loadLocalConfig } from './local-config.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cacheDirectory = join(root, '.cache');
const stampFile = join(cacheDirectory, 'dependencies.sha256');
const viteEntry = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const args = new Set(process.argv.slice(2));
let port;
let apiPort;

/** Carry an actionable code from a failed setup step to the terminal and troubleshooting guide. */
function failure(code, message) {
  return new Error(`[${code}] ${message}`);
}

/** Reject unsupported runtimes before installing packages or opening the portal. */
function validateEnvironment() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) {
    throw failure(
      'START001',
      'Node.js 22.12 veya üzeri gerekli. Node.js 24 LTS kurup tekrar deneyin.',
    );
  }
  if (
    ![port, apiPort].every((value) => Number.isInteger(value) && value >= 1024 && value <= 65535) ||
    port === apiPort
  ) {
    throw failure('START004', 'PORT ve API_PORT, 1024–65535 arasında farklı tam sayılar olmalı.');
  }
  for (const arg of args) {
    if (!['--no-open', '--prepare-only'].includes(arg)) {
      throw failure(
        'START004',
        `Desteklenmeyen seçenek: ${arg}. Seçenekler: --no-open, --prepare-only.`,
      );
    }
  }
}

/** Use the committed lockfile; repeat installation only after dependency or Node-major changes. */
async function prepareDependencies() {
  const fingerprint = createHash('sha256')
    .update(await readFile(join(root, 'package-lock.json')))
    .update(process.versions.node.split('.')[0])
    .digest('hex');
  const previous = await readFile(stampFile, 'utf8').catch(() => '');
  if (previous === fingerprint && existsSync(viteEntry)) return;

  console.log('Bağımlılıklar hazırlanıyor. İlk kurulumda internet bağlantısı gerekir.');
  await new Promise((resolve, reject) => {
    const windows = process.platform === 'win32';
    // The Windows shell receives a constant command; user paths are passed only through cwd.
    const install = spawn(windows ? 'npm.cmd ci' : 'npm', windows ? [] : ['ci'], {
      cwd: root,
      stdio: 'inherit',
      shell: windows,
      windowsHide: true,
    });
    install.on('error', () =>
      reject(failure('START002', 'npm çalıştırılamadı. Node.js kurulumunu kontrol edin.')),
    );
    install.on('close', (code) => {
      if (code === 0) resolve();
      else
        reject(
          failure(
            'START002',
            'Bağımlılıklar kurulamadı. İnternet bağlantısını ve yukarıdaki npm mesajını kontrol edin; sonra yeniden başlatın.',
          ),
        );
    });
  });
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(stampFile, fingerprint);
}

/** Check the selected port without stopping or replacing another process on the machine. */
async function checkPort(selectedPort = port) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () =>
      reject(
        failure(
          'START003',
          `${selectedPort} portu kullanılamıyor. Önceki portal penceresini kapatın veya PORT / API_PORT değişkeniyle başka port seçin.`,
        ),
      ),
    );
    probe.listen(selectedPort, '0.0.0.0', () => probe.close(resolve));
  });
}

/** Start this checkout's Vite executable and keep its lifecycle attached to the launcher. */
async function startPortal(python) {
  await checkPort();
  await checkPort(apiPort);
  const backend = await startBackend(root, python, apiPort);
  console.log(`\nPozitifAI Portal · http://localhost:${port}/`);
  console.log('Durdurmak için bu terminalde Ctrl+C kullanın.\n');
  const viteArgs = [viteEntry, '--host', '0.0.0.0', '--port', String(port), '--strictPort'];
  if (!args.has('--no-open')) viteArgs.push('--open');
  const server = spawn(process.execPath, viteArgs, {
    cwd: join(root, 'frontend'),
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, API_PORT: String(apiPort) },
  });
  let stopping = false;
  const stop = () => {
    stopping = true;
    server.kill();
    backend.kill();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  backend.once('exit', () => {
    if (!stopping) server.kill();
  });
  await new Promise((resolve, reject) => {
    server.once('error', () => {
      backend.kill();
      reject(failure('START005', 'Portal başlatılamadı. Bağımlılıkları npm ci ile yeniden kurun.'));
    });
    server.once('close', (code) => {
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
      backend.kill();
      if (stopping || code === 0) resolve();
      else
        reject(
          failure(
            'START005',
            'Portal beklenmedik şekilde durdu. Yukarıdaki hata mesajını ve docs/troubleshooting.md dosyasını inceleyin.',
          ),
        );
    });
  });
}

try {
  loadLocalConfig(root);
  port = Number(process.env.PORT || 5173);
  apiPort = Number(process.env.API_PORT || 8000);
  validateEnvironment();
  if (!args.has('--prepare-only')) {
    await checkPort();
    await checkPort(apiPort);
  }
  await prepareDependencies();
  const python = await prepareBackend(root, args.has('--prepare-only'));
  if (args.has('--prepare-only'))
    console.log('Kurulum hazır. Portalı start.bat veya npm start ile açabilirsiniz.');
  else await startPortal(python);
} catch (error) {
  console.error(error instanceof Error ? error.message : '[START000] Başlatma başarısız.');
  process.exitCode = 1;
}
