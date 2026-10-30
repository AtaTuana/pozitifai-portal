# Yerel ayarlar ve API kontrolü

`start.bat` / `npm start`, `.local/runtime.json` ayarlarını proje klasöründen okur. Ayarlar Node başlatıcısı üzerinden Django'ya aktarılır. Terminalde açıkça tanımlı bir değişken, kayıtlı dosyadaki aynı değişkenden önce gelir.

## Bir defalık kayıt

Neon bağlantısını ve API anahtarını tanımladığınız PowerShell penceresini kullanın. Çalışan portalı Ctrl+C ile durdurun ve proje klasöründe çalıştırın:

```powershell
npm run setup:local
```

Komut yalnızca bilinen PG, OpenAI ve portal çalışma ayarlarını kaydeder; terminaldeki diğer ortam değişkenlerini almaz. Gizli değerleri ekrana yazdırmaz. Kaydetmek, API anahtarının geçerli olduğunu doğrulamaz.

Çıktıda veritabanının **PostgreSQL** olduğunu kontrol edin. **SQLite** yazıyorsa mevcut terminalde ve kayıtlı ayarlarda `PGDATABASE` yoktur; Neon bağlantısını tanımladığınız terminalden tekrar kaydedin. Kaydetme komutu veritabanına bağlanmaz ve hiçbir veri taşımaz.

`.local/runtime.json` parolaları yerel dosyada saklar; şifreli bir kasa değildir. `.local/` Git dışında tutulur ve Vite tarafından sunulmaz. Bu dosyayı, `.local` klasörünü veya anahtar içeren ekran görüntülerini paylaşmayın. `.env` otomatik okunmaz; bu başlatıcının kalıcı ayar dosyası `.local/runtime.json` dosyasıdır.

## API isteğiyle doğrulama

```powershell
npm run check:openai
```

Kontrol, yapılandırılan modele tek küçük Responses API isteği gönderip `OK` yanıtını bekler; normal token ücretlendirmesine tabidir. Varsayılan model `gpt-6-luna`dır. Kaynak transkriptler gönderilmez; veritabanına bağlanılmaz. Yanıt tamamlanmadan başarı yazılmaz. Kontrol sınıflandırma doğruluğunu ölçmez.

Anahtar veya ham API hata gövdesi yazdırılmaz. HTTP durumu, güvenli hata kodu, süre ve token sayıları `.local/openai-verification.json` dosyasına kaydedilir. `401` anahtar doğrulama sorunudur; `403` izin, `404` model erişimi, `429` kredi/harcama/istek sınırı olabilir. Kodla birlikte değerlendirilmelidir. Kontrol otomatik tekrar deneme yapmaz.

## Tek tıkla açılış

Ayarlar kaydedildikten sonra proje kökündeki **start.bat** dosyasına çift tıklayın. Anahtar kontrolü normal açılışta yapılmaz ve açılış kendi başına OpenAI isteği göndermez. Sınıflandırma için sidebar’daki **Reddedilme nedenleri** alanını açın; tarih aralığı veya Tüm zamanlar seçip **Analiz Başlat** düğmesine basın. API çağrıları yalnızca bu işlemle başlar. Tamamlanmış analizler yeniden kullanılır.

Terminali kapatınca kayıtlı ayarlar korunur. Başlatıcı hem proje yolunu hem ayar yolunu kendi dosyasından bulur; kişiye özel bir yol kaynak koda yazılmaz. Yeni bir bilgisayarda o bilgisayara ait ayarlar yeniden tanımlanır.

Anahtarı değiştirmek için yeni değeri PowerShell'de tanımlayıp `npm run setup:local` komutunu tekrar çalıştırın. Aynı terminalde eski anahtar bulunuyorsa bu eski değer dosyadaki yeniyi geçersiz kılabilir; güncel değeri tanımlayın veya yeni terminal kullanın. Sonrasında `npm run check:openai` ile doğrulayın.

Doğrudan `backend/manage.py` çalıştırmak Node başlatıcısını atlar; bu kullanımda gereken ortam değişkenleri ayrıca tanımlanmalıdır.
