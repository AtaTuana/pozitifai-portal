# PozitifAI Portal

Satış çağrı merkezi raporlaması için React + TypeScript / Django web portalı.

**Mevcut aşama:** giriş, sunucu tarafında yetkilendirme, kullanıcı/profil yönetimi ve takım–kampanya–temsilci planlaması çalışır. Giriş kartından çalışma alanına genişleyen cam geçişi, sidebar, özgün logo, 70 px navbar, açık/koyu tema, perspektif ve su izi ortak kabukta korunur. Veri yükleme, KPI hesaplama, Excel raporları ve LLM sınıflandırması henüz uygulanmamıştır; genel bakış boş durum gösterir.

## Yerelde başlatma

1. [Node.js 24 LTS](https://nodejs.org/) ve [Python 3.12](https://www.python.org/downloads/) kurulu olsun. Desteklenen sürümler: Node.js 22.12 veya üzeri; Python 3.11–3.14.
2. Windows'ta **start.bat dosyasına çift tıklayın**. macOS/Linux'ta proje klasöründe `npm start` çalıştırın.
3. İlk açılışta npm paketleri ve projeye özel Python `.venv` ortamı hazırlanır; veritabanı tabloları oluşturulur.
4. Terminal ilk admin için **ad soyad, e-posta ve şifre** ister. Şifre en az 12 karakter olmalı; yazarken görünmemesi normaldir. Hazır veya ortak admin şifresi yoktur.
5. Tarayıcıda `http://localhost:5173/` açılır. Oluşturduğunuz hesapla giriş yapın.

İlk kurulum internet gerektirir. Bağımlılıklar değişmedikçe tekrar indirilmez. Terminal açık kalmalıdır; **Ctrl+C** iki sunucuyu da durdurur. Eski geliştirme terminali varsa önce onu durdurun. Proje kendi konumunu bulur; kaynak kodunda kişiye özel kurulum yolu yoktur.

Diğer cihazlar aynı güvenilir yerel ağda terminaldeki **Network** adresini açabilir; bu cihazlara uygulama kurulmaz. Django yalnızca `127.0.0.1:8000` adresini dinler; tarayıcı istekleri aynı kökenden `/api` üzerinden iletilir. Yerel HTTP sunumu canlı internet yayını değildir; üretim için HTTPS ve ayrı dağıtım yapılandırması gerekir.

## Yetkiler

| Rol               | Veri kapsamı          | Takım/kampanya/temsilci düzenleme | Hesap ve rol yönetimi | Yükleme yetkisi* |
| ----------------- | --------------------- | --------------------------------- | --------------------- | ---------------- |
| Admin (tek hesap) | Tüm takımlar          | Evet                              | Evet                  | Evet             |
| Yönetici          | Tüm takımlar          | Hayır                             | Hayır                 | Evet             |
| Takım kaptanı     | Yalnızca kendi takımı | Hayır                             | Hayır                 | Hayır            |
| Temsilci          | Giriş hesabı yok      | —                                 | —                     | —                |

_Yükleme yetki sözleşmesinde tanımlıdır; dosya yükleme ekranı/API'si sonraki aşamadır._

Admin, **Takım planlama** ekranından kayıt oluşturur; haritada veya Özellikler panelinde bağlantıları kurup **Kaydet** ile veritabanına işler. Bir takım birden fazla kampanyaya, kampanya birden fazla takıma bağlanabilir. Bir temsilcinin en fazla bir takımı olur. Bağlantısız kayıtlar tutulabilir. Temsilci kaydı giriş hesabı değildir. Kullanıcı oluştururken takım kaptanı için takım seçmek zorunludur.

Taslak için geri al/yinele ve kopyalama vardır. Kayıt kaldırma kaydedildiğinde arşivleme yapar; kaynak kayıt fiziksel olarak silinmez. Kaptanı bağlı takım önce kaptan ataması değiştirilmeden kaldırılamaz. İki sekmedeki çakışan kayıtlar sürüm denetimiyle reddedilir.

## Veritabanı ve özel dosyalar

Hesap ve organizasyon tabloları varsayılan olarak **SQLite** ile çalışır. Çağrı/kalite/rapor tablolarının nihai 3NF tasarımı henüz eklenmedi. `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT` ortam değişkenleri verilirse aynı Django modelleri PostgreSQL kullanır; bu sürümün çalıştırılan testleri SQLite üzerindedir.

- `.local/portal.sqlite3`: kullanıcılar, organizasyon, oturumlar ve işlem kayıtları.
- `.local/secret.key`: yerel gizli anahtar.
- `.venv/`, `node_modules/`, `.cache/`: yeniden oluşturulabilen çalışma dosyaları.

Bu klasörler Git tarafından dışlanır. `.local` içeriğini paylaşmayın; yedek alırken uygulama durmuşken veritabanı ve anahtarı birlikte güvenli saklayın. Vite bu özel klasörleri sunmaz. `PORTAL_DATA_DIR` ayrı veri dizini, `PORTAL_PYTHON` otomatik bulunamayan Python çalıştırılabilir dosyasını seçer.

## Geliştirme ve doğrulama

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
    models.py             Kimlik, organizasyon ve işlem günlüğü
    middleware.py         Oturum süresi ve yetki iptali
    migrations/           Sürümlenmiş veritabanı yapısı
    tests/                Yetki, CSRF, oturum ve bütünlük testleri
frontend/src/
  app/                    Oturum ve sayfa bileşimi
  api/                    Tipler ve ortak HTTP istemcisi
  features/auth/          Giriş ve cam genişleme animasyonu
  features/planning/      Kütüphane, harita, özellikler, taslak geçmişi
  features/users/         Kullanıcı ve profil ekranları
  features/workspace/     Sidebar ve kayıt ekranları
  components/             Ortak logo, cam, tema ve UI bileşenleri
  config/visual.config.ts  Boyut, blur, perspektif ve geçiş ayarları
scripts/                  Django ve Vite başlatıcıları
```

- [Görsel mimari](docs/ui-foundation.md)
- [Güvenlik kapsamı](docs/security.md)
- [Hata kılavuzu](docs/troubleshooting.md)

Arayüz akışları, kullanıcı tarafından verilen ReportGuerilla incelenerek PozitifAI rollerine ve görsel katmanlarına uyarlanmıştır. Referansın hesapları, veritabanı, şifre özetleri, rapor kodları ve şirket verileri taşınmamıştır. Harita [React Flow](https://reactflow.dev/) ile uygulanır; paketin MIT lisansı korunur. Özgün logo `frontend/public/assets/logo.svg` içindedir. Case dokümanları ve dataset bu sürüme dahil değildir; dışarıdaki Documents klasörü yalnızca okunacak kaynak olarak korunur.
