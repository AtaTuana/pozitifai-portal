import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';

function run(command, args, root, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
    child.once('error', () =>
      reject(
        new Error('[START006] Python başlatılamadı. Python 3.11–3.14 kurulumunu kontrol edin.'),
      ),
    );
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              '[START007] Django hazırlığı tamamlanamadı. Yukarıdaki hatayı kontrol edip tekrar başlatın.',
            ),
          ),
    );
  });
}

/** Locate a supported runtime without baking this developer's install paths into the project. */
function locatePython() {
  const candidates = [
    ...(process.env.PORTAL_PYTHON ? [[process.env.PORTAL_PYTHON, []]] : []),
    ...['3.12', '3.13', '3.14', '3.11'].map((version) => ['py', [`-${version}`]]),
    ['python3', []],
    ['python', []],
  ];
  for (const [command, prefix] of candidates) {
    const probe = spawnSync(
      command,
      [
        ...prefix,
        '-c',
        'import sys; print(sys.executable); sys.exit(0 if (3,11) <= sys.version_info[:2] < (3,15) else 1)',
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 5000 },
    );
    if (probe.status === 0) return probe.stdout.trim();
  }
  throw new Error(
    '[START006] Python 3.11–3.14 bulunamadı. Python kurun veya PORTAL_PYTHON değişkenine Python yolunu yazın.',
  );
}

export async function prepareBackend(root, prepareOnly) {
  const python = join(
    root,
    '.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );
  if (
    !existsSync(python) ||
    spawnSync(python, ['-c', 'import sys'], { windowsHide: true }).status !== 0
  ) {
    console.log('Python ortamı hazırlanıyor…');
    await run(locatePython(), ['-m', 'venv', join(root, '.venv')], root);
  }
  const requirements = join(root, 'backend', 'requirements.txt');
  const fingerprint = createHash('sha256')
    .update(await readFile(requirements))
    .digest('hex');
  const stamp = join(root, '.cache', 'python-dependencies.sha256');
  if (
    (await readFile(stamp, 'utf8').catch(() => '')) !== fingerprint ||
    spawnSync(python, ['-c', 'import django, psycopg, waitress'], { windowsHide: true }).status !==
      0
  ) {
    await run(python, ['-m', 'pip', 'install', '-r', requirements], root);
    await mkdir(join(root, '.cache'), { recursive: true });
    await writeFile(stamp, fingerprint);
  }
  await run(python, [join(root, 'backend/manage.py'), 'migrate', '--noinput'], root);
  if (!prepareOnly) await run(python, [join(root, 'backend/manage.py'), 'bootstrap_admin'], root);
  return python;
}

/** Keep the API on loopback; the frontend proxies requests through the same browser origin. */
export async function startBackend(root, python, port) {
  const hosts = Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4')
    .map((item) => item.address);
  const child = spawn(python, ['backend/serve.py'], {
    cwd: root,
    env: {
      ...process.env,
      API_PORT: String(port),
      PORTAL_ALLOWED_HOSTS: [...hosts, process.env.PORTAL_ALLOWED_HOSTS || ''].join(','),
    },
    stdio: 'inherit',
    windowsHide: true,
  });
  let failure;
  child.once('error', (error) => {
    failure = error;
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && !failure && child.exitCode === null) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/session`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return child;
    } catch {
      /* Wait for Django's first connection. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  child.kill();
  throw new Error(
    '[START008] Django API başlatılamadı. Yukarıdaki hatayı ve API_PORT değerini kontrol edin.',
  );
}
