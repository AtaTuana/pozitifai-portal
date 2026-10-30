import { collectLocalSettings, saveLocalSettings } from './local-config.mjs';

try {
  const settings = collectLocalSettings();
  if (!settings.OPENAI_API_KEY?.trim()) {
    throw new Error(
      '[LLM001] Önce bu terminalde OPENAI_API_KEY tanımlayın; ardından komutu tekrar çalıştırın.',
    );
  }
  settings.OPENAI_API_KEY = settings.OPENAI_API_KEY.trim();
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
  console.log('API anahtarı kaydedildi; bu işlem anahtarın geçerliliğini doğrulamaz.');
  console.log('Bağlantıyı kontrol etmek için: npm run check:openai');
  console.log('Sonraki açılışlarda start.bat dosyasına çift tıklayabilirsiniz.');
} catch (error) {
  const message =
    error instanceof Error && /^\[(?:START009|LLM001)\]/.test(error.message)
      ? error.message
      : '[START009] Yerel ayarlar kaydedilemedi. .local klasörünün yazma iznini kontrol edin.';
  console.error(message);
  process.exitCode = 1;
}
