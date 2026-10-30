import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadLocalConfig, portalRoot } from './local-config.mjs';

const messages = {
  400: 'İstek kabul edilmedi; model ve parametreler kontrol edilmeli.',
  401: 'API anahtarı kabul edilmedi. Güncel anahtarı tekrar tanımlayın.',
  403: 'Proje veya API anahtarı bu istek için yetkili değil.',
  404: 'Model bulunamadı veya bu projede modele erişim yok.',
  429: 'Kredi, harcama veya istek limiti. api_error_code alanını kontrol edin.',
};

/** Make exactly one small inference request without sending any case-study data. */
async function verify() {
  loadLocalConfig();
  const key = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL || 'gpt-6-luna';
  if (!key) return { ok: false, message: '[LLM001] API anahtarı tanımlı değil.' };
  if (!/^[\x21-\x7E]+$/.test(key)) {
    return { ok: false, message: '[LLM002] API anahtarında boşluk veya geçersiz karakter var.' };
  }
  const started = performance.now();
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: 'Reply with exactly OK.',
        reasoning: { effort: 'none' },
        max_output_tokens: 128,
        store: false,
      }),
      signal: AbortSignal.timeout(45000),
      redirect: 'error',
    });
    const data = await response.json();
    if (!response.ok) {
      const rawCode = data.error?.code;
      return {
        ok: false,
        model,
        http_status: response.status,
        api_error_code:
          typeof rawCode === 'string' && /^[a-z_]{1,80}$/.test(rawCode) ? rawCode : null,
        message: messages[response.status] || 'OpenAI isteği başarısız oldu.',
      };
    }
    const text = (data.output || [])
      .filter((item) => item.type === 'message')
      .flatMap((item) => item.content || [])
      .filter((part) => part.type === 'output_text')
      .map((part) => part.text)
      .join('')
      .trim();
    const ok = data.status === 'completed' && text === 'OK';
    return {
      ok,
      model,
      http_status: response.status,
      message: ok
        ? 'BAĞLANTI BAŞARILI: Model OK yanıtı verdi.'
        : 'API yanıt verdi ancak tamamlanmış OK yanıtı alınamadı.',
      elapsed_seconds: Math.round((performance.now() - started) / 10) / 100,
      input_tokens: data.usage?.input_tokens,
      output_tokens: data.usage?.output_tokens,
    };
  } catch {
    return {
      ok: false,
      model,
      http_status: response?.status,
      message: '[LLM003] Bağlantı kurulamadı, zaman aşımı oldu veya yanıt okunamadı.',
    };
  }
}

try {
  console.log('OpenAI bağlantısı kontrol ediliyor (tek küçük istek)…');
  const result = { checked_at_utc: new Date().toISOString(), ...(await verify()) };
  const safeOutput = JSON.stringify(result, null, 2) + '\n';
  console.log(safeOutput);
  try {
    await mkdir(join(portalRoot, '.local'), { recursive: true });
    await writeFile(join(portalRoot, '.local', 'openai-verification.json'), safeOutput, {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch {
    console.error('Kontrol sonucu dosyaya kaydedilemedi; yukarıdaki sonuç geçerlidir.');
  }
  process.exitCode = result.ok ? 0 : 1;
} catch {
  console.error('[START009] Yerel ayarlar okunamadı; .local/runtime.json biçimini kontrol edin.');
  process.exitCode = 1;
}
