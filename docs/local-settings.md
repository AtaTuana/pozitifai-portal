# Yerel ayarlar ve API kontrolü

## Windows'ta tek başlangıç noktası

`start.bat`, `scripts/start-windows.ps1` dosyasını çalıştırır. `windows-runtimes.ps1` Node/npm ve Python'u bulur; eksik veya desteklenmeyen sürüm için WinGet üzerinden `OpenJS.NodeJS.LTS` ve `Python.Python.3.13` kurulumunu başlatır. Uyumlu mevcut programlar yeniden kurulmaz. Kurulumdan sonra PATH aynı işlemde yenilenir; terminali elle yeniden açmak gerekmez.

WinGet yoksa Microsoft'un `Microsoft.WinGet.Client` modülü ve `Repair-WinGetPackageManager` yöntemi kullanıcı kapsamında denenir. Kurum politikası, Windows sürümü, bağlantı veya kurulum izni engeli otomatik aşılmaz; açıklamalı hata gösterilir. UAC ve gerekiyorsa Windows yeniden başlatması kullanıcıya aittir. Otomatik kurulum Windows içindir.

`windows-settings.ps1`, aynı pencerede eksik Neon Host, Database, Role/User ve gizli veritabanı şifresini sorar. Mevcut paylaşılan Neon veritabanı kullanılabilir; yeni bir veritabanı veya PostgreSQL sunucusu kurmak gerekmez. Bu bağlantıyı alan bir kişi veritabanına doğrudan erişim yetkisini de alır; portal hesabının rolüyle aynı yetki değildir. Paylaşılacak veritabanı hesabı bilinçli seçilmelidir.

Eksik OpenAI anahtarı gizli girişle sorulur. Enter ile atlanabilir; sonraki açılışta tekrar sorulur. Kayıtlı anahtar varsa yeniden istenmez. Giriş değeri kaydedilir ama otomatik ücretli OpenAI isteği yapılmaz; ilk gerçek analiz veya ayrı kontrol komutu geçerliliği ortaya çıkarır.

## Kayıt ve öncelik

Ayarlar `scripts/setup-local.mjs` üzerinden `.local/runtime.json` dosyasına atomik olarak yazılır. `.local/` Git dışında tutulur ve Vite tarafından sunulmaz. Dosya yerel parolaları içerir; şifreli kasa değildir. Dosyayı veya içeriğini GitHub'a, sohbete ya da ekran görüntüsüne koymayın. `.env` otomatik okunmaz.

Terminalde açıkça tanımlanan değişkenler kayıtlı dosyadan önce gelir. Windows sihirbazındaki yeni girişler o başlangıç işleminin ortamına ve kayıt dosyasına uygulanır. Veritabanı ayarları eksikse etkileşimli Windows akışı bunları tamamlatır; yanlış Neon bilgisiyle yeni bir SQLite veritabanına geçmez. PostgreSQL bağlantısı, migration ve admin işlemlerinden önce `check_database` komutunun `SELECT 1` sorgusuyla kontrol edilir.

Yeni bir bilgisayarda Neon veritabanına bağlanmak, kayıtlı portal hesabıyla giriş yapma gereksinimini kaldırmaz. Mevcut admin varsa başka admin oluşturulmaz. Veritabanının şifresi ile portal hesabının şifresi farklıdır.

## İsteğe bağlı komutlar

Normal kullanıcı için yalnızca `start.bat` yeterlidir. Sorun giderme veya ayar değiştirme gerektiğinde proje klasöründe:

```powershell
.\start.bat --configure    # Ayarları yeniden sor; Enter mevcut değeri korur
.\start.bat --check-tools  # Yalnız Node/npm/Python kontrolü; kurulum, kayıt veya DB bağlantısı yok
.\start.bat --no-open      # Portalı çalıştır, tarayıcıyı otomatik açma
.\start.bat --prepare-only # Program/paket ve DB hazırlığı; ayar soruları, admin ve sunucu yok
```

`--prepare-only` ayar sihirbazını atlar; PG ayarları yoksa mevcut Node başlatıcısının SQLite davranışı geçerlidir. Doğrudan `npm start` otomatik Windows program kurulumu veya soru akışını çalıştırmaz; Node/Python kurulu ve gerekli değişkenler tanımlı olmalıdır. Ortam değişkenlerini zaten tanımlayanlar `npm run setup:local` ile kaydedebilir; API anahtarı bu komut için artık zorunlu değildir. Doğrudan `backend/manage.py` Node başlatıcısını da atlar, ortam değişkenlerini ayrıca gerektirir.

## API isteğiyle doğrulama

```powershell
npm run check:openai
```

Bu komut yapılandırılan modele tek küçük Responses API isteği gönderir; normal token ücretlendirmesine tabidir. Varsayılan model `gpt-6-luna`dır. Kaynak transkriptler gönderilmez. Bu kontrol sınıflandırma doğruluğunu ölçmez.

Anahtar veya ham API hata gövdesi yazdırılmaz. HTTP durumu, güvenli hata kodu, süre ve token sayıları `.local/openai-verification.json` dosyasına kaydedilir. `401` anahtar, `403` erişim, `404` model, `429` kullanım sınırı olabilir. Model analizi yalnızca portalın Reddedilme nedenleri sayfasındaki Analiz Başlat işlemiyle başlar; tamamlanmış sonuçlar yeniden kullanılır.

Resmî kaynaklar: [WinGet kurulumu](https://learn.microsoft.com/en-us/windows/package-manager/winget/), [WinGet paket yükleme seçenekleri](https://learn.microsoft.com/en-us/windows/package-manager/winget/install), [Python Windows kurulum seçenekleri](https://docs.python.org/3.13/using/windows.html).
