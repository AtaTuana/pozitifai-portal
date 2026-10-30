import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const portalRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const settingNames = [
  'PGHOST',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
  'PGPORT',
  'PGSSLMODE',
  'PGCHANNELBINDING',
  'PGCONNECT_TIMEOUT',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'PORT',
  'API_PORT',
  'PORTAL_PYTHON',
  'PORTAL_DATA_DIR',
  'PORTAL_HTTPS',
  'PORTAL_ALLOWED_HOSTS',
];

/** Read only known local settings; parse errors must never echo a secret value. */
export function readLocalConfig(root = portalRoot) {
  const path = join(root, '.local', 'runtime.json');
  if (!existsSync(path)) return {};
  try {
    const document = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
    if (
      document.version !== 1 ||
      !document.settings ||
      typeof document.settings !== 'object' ||
      Array.isArray(document.settings)
    ) {
      throw new Error();
    }
    const settings = {};
    for (const [name, value] of Object.entries(document.settings)) {
      if (!settingNames.includes(name) || typeof value !== 'string') throw new Error();
      settings[name] = value;
    }
    return settings;
  } catch {
    throw new Error(
      '[START009] .local/runtime.json okunamadı. Dosya biçimini veya okuma iznini kontrol edin.',
    );
  }
}

/** Explicit terminal variables take precedence over this machine's saved defaults. */
export function loadLocalConfig(root = portalRoot, environment = process.env) {
  for (const [name, value] of Object.entries(readLocalConfig(root))) {
    if (environment[name] === undefined) environment[name] = value;
  }
}

/** Capture the existing Neon session without logging credentials or unrelated variables. */
export function collectLocalSettings(root = portalRoot, environment = process.env) {
  const settings = readLocalConfig(root);
  for (const name of settingNames) {
    if (environment[name] !== undefined) settings[name] = environment[name];
  }
  return settings;
}

/** Replace the local configuration atomically; the ignored .local directory stays private. */
export async function saveLocalSettings(settings, root = portalRoot) {
  const directory = join(root, '.local');
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `runtime-${randomUUID()}.tmp`);
  const knownSettings = Object.fromEntries(
    settingNames
      .filter((name) => typeof settings[name] === 'string')
      .map((name) => [name, settings[name]]),
  );
  await writeFile(
    temporary,
    JSON.stringify({ version: 1, settings: knownSettings }, null, 2) + '\n',
    {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    },
  );
  await rename(temporary, join(directory, 'runtime.json'));
}
