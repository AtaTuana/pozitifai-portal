import { collectLocalSettings, saveLocalSettings } from './local-config.mjs';

try {
  const settings = collectLocalSettings();
  settings.OPENAI_API_KEY = settings.OPENAI_API_KEY?.trim() || '';
  if (settings.OPENAI_API_KEY && !/^[\x21-\x7E]+$/.test(settings.OPENAI_API_KEY)) {
    throw new Error('[LLM002] API anahtarında boşluk veya geçersiz karakter var.');
  }
  settings.OPENAI_MODEL ||= 'gpt-6-luna';
  if (settings.PGDATABASE && (!settings.PGHOST || !settings.PGUSER || !settings.PGPASSWORD)) {
    throw new Error(
      '[START009] Neon ayarları eksik. PGHOST, PGDATABASE, PGUSER ve PGPASSWORD değerlerinin tanımlandığı terminali kullanın.',
    );
  }
  await saveLocalSettings(settings);
  console.log('Yerel ayarlar .local/runtime.json dosyasına kaydedildi.');
  console.log(
    `Veritabanı: ${settings.PGDATABASE ? 'PostgreSQL (Neon/PG ayarları kaydedildi)' : 'SQLite (bu terminalde PGDATABASE bulunamadı)'}`,
  );
  console.log(
    settings.OPENAI_API_KEY
      ? 'API anahtarı kaydedildi; geçerliliğini kontrol etmek için: npm run check:openai'
      : 'OpenAI anahtarı yok. Portal açılır; yeni ret analizi için anahtar gerekir.',
  );
  console.log('Sonraki açılışlarda start.bat dosyasına çift tıklayabilirsiniz.');
} catch (error) {
  const message =
    error instanceof Error && /^\[(?:START009|LLM001|LLM002)\]/.test(error.message)
      ? error.message
      : '[START009] Yerel ayarlar kaydedilemedi. .local klasörünün yazma iznini kontrol edin.';
  console.error(message);
  process.exitCode = 1;
}
