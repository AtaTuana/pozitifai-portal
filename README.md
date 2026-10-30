# PozitifAI Portal

Satış çağrı merkezi raporlaması için React + TypeScript / Django web portalı.

**Mevcut aşama:** giriş, sunucu tarafında yetkilendirme, kullanıcı/profil yönetimi ve takım–kampanya–temsilci planlaması bulunur. Giriş kartından çalışma alanına genişleyen cam geçişi, sidebar, özgün logo, 70 px navbar, açık/koyu tema, perspektif ve su izi ortak kabukta korunur. CSV/TXT yükleme, numaralı kurallarla temizleme, Q1 kalite onarımı ve alan bazında işlem izi uygulanmıştır. Filtreli KPI özeti ve birleşik kırılımlar backend API'sinde hesaplanır; dashboard ve formüllü Excel indirme bağlanmıştır. Tarih ve kampanya kapsamındaki ret konuşmaları, kullanıcı isteğiyle OpenAI üzerinden sınıflandırılır; kayıtlı sonuçlar kategori grafiği ve konuşma görünümünde incelenir. [Ret analizi akışı ve prompt](docs/rejection-analysis.md). Çalıştırılmış kontrollerin kapsamı [doğrulama kaydında](docs/verification.md) belirtilir.

## Yerelde başlatma

1. [Node.js 24 LTS](https://nodejs.org/) ve [Python 3.12](https://www.python.org/downloads/) kurulu olsun. Desteklenen sürümler: Node.js 22.12 veya üzeri; Python 3.11–3.14.
2. Windows'ta **start.bat dosyasına çift tıklayın**. macOS/Linux'ta proje klasöründe `npm start` çalıştırın.
3. İlk açılışta npm paketleri ve projeye özel Python `.venv` ortamı hazırlanır; veritabanı tabloları oluşturulur.
4. Terminal ilk admin için **ad soyad, e-posta ve şifre** ister. Şifre en az 12 karakter olmalı; yazarken görünmemesi normaldir. Hazır veya ortak admin şifresi yoktur.
5. Tarayıcıda `http://localhost:5173/` açılır. Oluşturduğunuz hesapla giriş yapın.

İlk kurulum internet gerektirir. Bağımlılıklar değişmedikçe tekrar indirilmez. Terminal açık kalmalıdır; **Ctrl+C** iki sunucuyu da durdurur. Eski geliştirme terminali varsa önce onu durdurun. Proje kendi konumunu bulur; kaynak kodunda kişiye özel kurulum yolu yoktur.

Diğer cihazlar aynı güvenilir yerel ağda terminaldeki **Network** adresini açabilir; bu cihazlara uygulama kurulmaz. Django yalnızca `127.0.0.1:8000` adresini dinler; tarayıcı istekleri aynı kökenden `/api` üzerinden iletilir. Yerel HTTP sunumu canlı internet yayını değildir; üretim için HTTPS ve ayrı dağıtım yapılandırması gerekir.

Neon/API ayarlarını terminal kapandıktan sonra da kullanmak için, ayarların tanımlı olduğu PowerShell penceresinde bir defa `npm run setup:local` çalıştırın. Başlatıcı `.local/runtime.json` dosyasını proje konumundan okur; sonraki açılışlarda `start.bat` dosyasına çift tıklamak yeterlidir. API bağlantısı `npm run check:openai` ile ayrıca kontrol edilir. [Yerel ayar ve API kontrol kılavuzu](docs/local-settings.md).

## Mimari ve teknoloji seçimleri

Tarayıcıdaki React ekranları, aynı kökendeki `/api` adresleri üzerinden Django'ya istek gönderir. Django oturumu ve rol kapsamını doğrular; veriyi ORM ile veritabanından okur/yazar. CSV temizleme, KPI hesaplama, Excel üretimi ve LLM sınıflandırması ayrı modüllerdedir. Veritabanı parolası ve LLM anahtarı tarayıcıya gönderilmez.

| Seçim                 | Neden ve sınır                                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Python + Django       | Hazır kimlik doğrulama, parola hash'leme, CSRF, ORM ve migration desteği; veri temizleme ve raporlama aynı backend'de kalır. Yetki kapsamı uygulama sorgularında ayrıca uygulanır. |
| React + TypeScript    | Filtrelere bağlı ekran durumları, tekrar kullanılan bileşenler ve animasyonlar; tipler API sözleşmesini takip etmeyi kolaylaştırır. Sunucu doğrulamasının yerine geçmez.           |
| PostgreSQL / Neon     | İlişkisel bütünlük, transaction ve satır kilitleri; paylaşılan demo verisini kalıcı tutar. Bulut bağlantısı internet gerektirir.                                                   |
| SQLite                | Ayrı veritabanı sunucusu kurmadan yerel başlangıç sağlar. PostgreSQL ile aynı eşzamanlı yazma davranışını garanti etmez.                                                           |
| Formüllü XLSX şablonu | Kullanıcının tasarımını korur, Excel 2016 işlevleriyle filtre değişikliğinde yeniden hesaplanır. Sunucuda Excel kurulumu gerekmez; dosyanın hesaplanması Excel'de yapılır.         |
| OpenAI Responses API  | Ret sınıflandırmasında sabit kategori listesi ve yapılandırılmış JSON yanıtı; şema doğrulaması bozuk çıktıları engeller, anlamsal doğruluğu garanti etmez.                         |

## Temizleme kararları ve varsayımlar

- UTF-8 BOM, dosya ayıracı ve ondalık virgül kaynak biçimi olarak işlenir. Desteklenen Türkçe sonuç yazımları ve kanıtlanabilir karakter bozulmaları standartlaştırılır.
- Aynı kimlikte bütünüyle eşit kaynak satırlar tekilleştirilir. Aynı kimlikte çelişen satırlar için rastgele bir kayıt seçilmez; inceleme kaydı tutulur.
- Eksik/negatif süreye tahmini değer verilmez; çağrının geçerli sonucu korunur, süre ortalamasından çıkarılır. Kalite kaydının bulunmaması sıfır puan değildir.
- Kurtarılamayan alanın bütün çağrıyı kaybettirmemesi tercih edildi: tarihsiz çağrı genel toplamda kalır, tarih/saat kırılımına girmez; temsilcisi bilinmeyen çağrı hiçbir takım kaptanına gösterilmez. Kullanılamayan kayıtlar ve önce/sonra değerleri yükleme geçmişinde nedenleriyle incelenir.
- **Belirsiz sonuç varsayımı:** ulaşılan çağrı yalnızca `satis`, `ret`, `geri_ara` sonuçlarının toplamıdır. `???` ulaşılan veya ulaşılamayan diye tahmin edilmez; toplamda ayrıca gösterilir. Case'teki “ulasilamadi olmayan” tanımı geçerli dört sonuç için aynıdır; bozuk sonuçlarda bu temkinli yorum kullanılır.
- **Q1 v1 bir kaynak varsayımıdır:** proje sahibi örnek puanlardan `0.25 / 0.40 / 0.35` katsayılarını çıkarmıştır; bunlar case belgesinin verdiği resmî katsayılar değildir. Profil açıkça seçilirse geçerli üç alt puandan bozuk toplam onarılır. Hatalı alan belirlenemiyorsa puan uydurulmaz. Başka kaynakta kanıtsız uygulanmaz.
- Takım kırılımı güncel temsilci kadrosunu kullanır. Veritabanındaki üyelik geçmişi, bu raporda çağrı tarihindeki takımı seçmek için kullanılmaz.

Her kararın koşulu, kanıtı ve rapora etkisi [numaralı kural kataloğunda](docs/data-quality-rules.md), kayıt akışı [yükleme belgesinde](docs/data-imports.md) bulunur.

## Ret kategorileri ve prompt

Proje sahibi 25 görüşmeyi okuyup ret gerekçelerini dokuz başlıkta topladı: Güven Eksikliği, İlgilenmiyor, Düşünceli, Müsait Değil, Fiyat, Rakip Firma, Satış Kanalı, Gizlilik ve Dijital Platform. Kategoriler yalnızca son cümleye göre değil, itiraz ve temsilcinin önerisine verilen yanıtın bütününe göre seçilir. Bir görüşmeye en fazla iki farklı etiket verilir; yeterli dayanak yoksa boş liste döner. Bu nedenle kategori adetlerinin toplamı görüşme sayısını aşabilir.

Kullanılan metnin tamamı [sürümlü prompt dosyasında](backend/portal/rejection_analysis/prompts/rejection-v1.txt), kayıt/yeniden kullanım davranışı [ret analizi belgesinde](docs/rejection-analysis.md) paylaşılır. Çıktının JSON biçimine uyması, sınıflandırmanın doğru olduğunun kanıtı olarak kabul edilmez.

## Case kapsamı ve kalan işler

| Beklenti                                                                 | Bu sürümdeki durum                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Üç CSV'nin alınması, temizlenmesi, veritabanına yazılması ve hata raporu | Yükleme ekranları, temizleme servisi ve kural bazında işlem tablosu mevcut. Kaynak dosyalar korunur.                                                                                                                                |
| KPI'lar ve temsilci/takım/kampanya/gün kırılımları                       | Backend API'sinde mevcut. Dashboard seçilen filtrelerin özetini ve saatlik yoğunluğu gösterir.                                                                                                                                      |
| Tarih aralığı, temsilci ve kampanya filtresi                             | Mevcut; ayrıca takım filtresi ve rol kapsamı uygulanır.                                                                                                                                                                             |
| Temsilci sıralaması                                                      | **Eksik:** temsilci bazında KPI API'si bulunur, ancak performansa göre karşılaştırmalı sıralama ekranı henüz eklenmedi. İlk dashboard kapsamı KPI göstergeleriyle sınırlı tutuldu; temsilci kayıt listesi bu isterin yerine geçmez. |
| Filtrelenmiş Excel raporu                                                | Summary portal filtreleriyle açılır. Kullanıcı Excel'de filtreyi değiştirebilsin diye RawData tüm yetkili çağrıları içerir; bu, yalnız filtrelenmiş satırları dışa aktarmaktan farklıdır.                                           |
| Bonus ret analizi                                                        | API entegrasyonu ve ayrı web raporu mevcut. Kategori grafiği Excel dosyasına eklenmedi; 25 gerçek transkriptin sınıflandırma doğruluğu henüz ölçülmedi.                                                                             |

OpenAI bağlantısı küçük bir istekle, analiz kodu sahte sağlayıcı yanıtlarıyla doğrulandı. Bu kontroller gerçek 25 konuşmanın tamamlandığını veya etiketlerin doğru olduğunu göstermez. Case verisi üzerinde beklenen KPI değerleriyle bağımsız bir son karşılaştırma da teslim öncesi yapılmalıdır. Ayrıntılı ve tarihli kontrol kapsamı [doğrulama kaydında](docs/verification.md) bulunur.

İlk konuşulan Gemini karşılaştırması, yerel LLM ve tarayıcı üzerinden sınıflandırma bu sürümde uygulanmadı; tek API sağlayıcısıyla çalışan ana akışa öncelik verildi. Bunlar case'in zorunlu görevleri değildir. Canlıya dağıtım da bu sürümün kapsamı dışındadır; yerel sunum hedeflenir.

## Yetkiler

| Rol               | Veri kapsamı          | Takım/kampanya/temsilci düzenleme | Hesap ve rol yönetimi | Yükleme yetkisi* |
| ----------------- | --------------------- | --------------------------------- | --------------------- | ---------------- |
| Admin (tek hesap) | Tüm takımlar          | Evet                              | Evet                  | Evet             |
| Yönetici          | Tüm takımlar          | Hayır                             | Hayır                 | Evet             |
| Takım kaptanı     | Yalnızca kendi takımı | Hayır                             | Hayır                 | Hayır            |
| Temsilci          | Giriş hesabı yok      | —                                 | —                     | —                |

_Çağrı, kalite ve transkript yüklemesini admin/yönetici yapar. Temsilci kadrosunu yalnızca admin yükler._

Admin, **Takım planlama** ekranından kayıt oluşturur; haritada veya Özellikler panelinde bağlantıları kurup **Kaydet** ile veritabanına işler. Bir takım birden fazla kampanyaya, kampanya birden fazla takıma bağlanabilir. Bir temsilcinin aynı anda en fazla bir takımı olur; takım değişiklikleri üyelik geçmişinde korunur. Bağlantısız kayıtlar tutulabilir. Temsilci kaydı giriş hesabı değildir. Kullanıcı oluştururken takım kaptanı için takım seçmek zorunludur.

Taslak için geri al/yinele ve kopyalama vardır. Kayıt kaldırma kaydedildiğinde arşivleme yapar; kaynak kayıt fiziksel olarak silinmez. Kaptanı bağlı takım önce kaptan ataması değiştirilmeden kaldırılamaz. İki sekmedeki çakışan kayıtlar sürüm denetimiyle reddedilir.

## Veritabanı ve özel dosyalar

Portal varsayılan olarak **SQLite** ile çalışır. Hesap, organizasyon, takım üyeliği geçmişi, çağrı, kalite, transkript, yükleme ve analiz tabloları [veritabanı tasarımında](docs/database.md) açıklanır. `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT` ortam değişkenleri verilirse aynı Django modelleri PostgreSQL kullanır. PostgreSQL kurulumunu [Neon kılavuzu](docs/cloud-postgresql.md) açıklar; doğrulama kapsamı ayrı kaydedilir.

- `.local/portal.sqlite3`: portal veritabanı.
- `.local/backups/`: bekleyen migration öncesinde otomatik oluşturulan SQLite yedekleri.
- `.local/secret.key`: yerel gizli anahtar.
- `.venv/`, `node_modules/`, `.cache/`: yeniden oluşturulabilen çalışma dosyaları.

Bu klasörler Git tarafından dışlanır. `.local` içeriğini paylaşmayın; yedek alırken uygulama durmuşken veritabanı ve anahtarı birlikte güvenli saklayın. Vite bu özel klasörleri sunmaz. `PORTAL_DATA_DIR` ayrı veri dizini, `PORTAL_PYTHON` otomatik bulunamayan Python çalıştırılabilir dosyasını seçer.

## Geliştirme ve doğrulama

Dosya yüklemek için admin hesabıyla **Temsilciler → Temsilci kadrosu yükle** alanından `agents.csv` seçilir. Ardından admin/yönetici **Veri yükleme** sayfasından `calls.csv`, `quality_scores.csv` ve transkript klasörünü ayrı alanlara yükler. Kalite için yalnızca bu case kaynağına uygun **Q1 v1** profili seçilir. Kaynak dosyalar değiştirilmez; sonuçlar yükleme geçmişinden ve kural filtresinden incelenir. Ayrıntılar: [yükleme akışı](docs/data-imports.md).

```sh
npm start -- --no-open       # Django + Vite; tarayıcıyı otomatik açma
npm start -- --prepare-only  # Paketler ve tablolar; admin/sunucu başlatma yok
npm run check               # TypeScript
npm run test:graphics       # Referans perspektif, CSS eşliği ve takip hızı testleri
npm run build               # TypeScript + frontend derlemesi
npm run format:check         # TS/CSS/JS/Markdown biçim kontrolü
```

Windows backend komutları:

```powershell
.\.venv\Scripts\python.exe backend/manage.py test portal.tests
.\.venv\Scripts\python.exe backend/manage.py check
```

Python biçimlendirmesi için `backend/requirements-dev.txt` isteğe bağlı kurulur; `.venv\Scripts\python.exe -m black backend` kullanılır. macOS/Linux'ta Python yolu `.venv/bin/python` olur. `npm run dev` yalnızca arayüzü başlatır; çalışan Django olmadan giriş yapamazsınız. `npm run preview` sadece derlenmiş arayüz incelemesidir, tam portal başlatıcısı değildir.

Alternatif portlar PowerShell'de `$env:PORT=5174` ve `$env:API_PORT=8001` ile seçilir; değerler farklı olmalıdır. Dev sunucusu açıkken `npm ci` çalıştırmayın; Windows yüklenmiş modülleri kilitleyebilir.

## Kaynak düzeni

```text
backend/
  config/                 Django ayarları, URL ve WSGI girişi
  portal/
    accounts.py           Giriş, profil, şifre ve hesap işlemleri
    permissions.py        Rol kapsamına göre sorgu sınırları
    planning.py           Taslak doğrulama ve ilişkisel kayıt
    imports.py            Yetkili multipart yükleme ve işlem izi API'si
    reports.py            Oturum korumalı KPI ve Excel indirme API'si
    reporting/            Filtreler, yetkili sorgular, ortak KPI ve kırılım hesapları
      excel/              Yetkili ham veri sorgusu ve XLSX doldurma
      templates/          Formüllü rapor şablonu
    rejection_analysis/   Sürümlü prompt, sağlayıcı, kayıtlı ret analizi ve konuşma ayrıştırma
    ingestion/            Ayrıştırma, temizleme, kalıcı kayıt ve geç eşleştirme
    models/               Kimlik, organizasyon, raporlama, yükleme ve analiz şeması
    services/             Atomik takım üyeliği işlemleri
    fields.py             Türkiye yerel saati için tarih alanı
    middleware.py         Oturum süresi ve yetki iptali
    migrations/           Sürümlenmiş veritabanı yapısı
    tests/                Yetki, CSRF, oturum ve bütünlük testleri
frontend/src/
  app/                    Oturum ve sayfa bileşimi
  api/                    Tipler ve ortak HTTP istemcisi
  features/auth/          Giriş ve cam genişleme animasyonu
  features/planning/      Kütüphane, harita, özellikler, taslak geçmişi
  features/users/         Kullanıcı ve profil ekranları
  features/imports/       CSV/TXT yükleme, özetler ve kural bazında işlem izi
  features/dashboard/     Filtreler, animasyonlu KPI göstergeleri ve Excel indirme
  features/rejections/    Takvim, analiz orb'u, kategori grafiği ve konuşmalar
  features/workspace/     Sidebar ve kayıt ekranları
  components/             Ortak logo, cam, tema ve UI bileşenleri
  config/visual.config.ts  Boyut, blur, perspektif ve geçiş ayarları
scripts/                  Django ve Vite başlatıcıları
```

- [Veritabanı tasarımı ve geçiş](docs/database.md)
- [Veri kalitesi kural kataloğu ve karar akışları](docs/data-quality-rules.md)
- [Dosya yükleme ve temizleme akışı](docs/data-imports.md)
- [Filtreli KPI ve kırılım API'si](docs/reporting-api.md)
- [Excel raporu ve formüller](docs/excel-report.md)
- [Neon PostgreSQL kurulum adımları](docs/cloud-postgresql.md)
- [Görsel mimari](docs/ui-foundation.md)
- [Güvenlik kapsamı](docs/security.md)
- [Hata kılavuzu](docs/troubleshooting.md)

Arayüz akışları, kullanıcı tarafından verilen ReportGuerilla incelenerek PozitifAI rollerine ve görsel katmanlarına uyarlanmıştır. Referansın hesapları, veritabanı, şifre özetleri, rapor kodları ve şirket verileri taşınmamıştır. Harita [React Flow](https://reactflow.dev/) ile uygulanır; paketin MIT lisansı korunur. Özgün logo `frontend/public/assets/logo.svg` içindedir. Case dokümanları ve dataset bu sürüme dahil değildir; dışarıdaki Documents klasörü yalnızca okunacak kaynak olarak korunur.
