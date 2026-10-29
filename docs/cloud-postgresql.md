# Neon üzerinde PostgreSQL kurulumu

Bu kılavuz mevcut Django portalını yeni, boş bir Neon PostgreSQL veritabanına bağlamak içindir. Portal bilgisayarda çalışır; veritabanı cloud'da bulunur. İnternet bağlantısı gerekir. Bu işlem web uygulamasına herkese açık bir internet adresi vermez.

Durum: PostgreSQL seçimi mevcut Django ayarlarında vardır. Bu kılavuz hazırlanırken Neon projesi oluşturulmadı, bağlantı kurulmadı veya cloud migration çalıştırılmadı. Mevcut migration zincirinin çalıştırılmış doğrulaması SQLite üzerindedir; ilk PostgreSQL kurulumu aşağıdaki adımlarda doğrulanacaktır.

## Neden bu seçenek?

Proje SQLite ve PostgreSQL için hazırlanmıştır. Neon yönetilen PostgreSQL sağlar; bilgisayara PostgreSQL sunucusu veya Microsoft SQL Server kurmak gerekmez. Tablolar Django modelleri ve migration dosyalarıyla oluşturulur. Yönetim panelinden aynı tabloları elle kurmak, migration geçmişiyle çelişir.

30 Ekim 2026'da kontrol edilen Free plan: kredi kartı gerektirmeyen ücretsiz hesap, proje başına 1 GB veritabanı depolaması ve aylık 100 CU-saat işlem kotası. CU-saat doğrudan portalın açık kalma saati demek değildir; ayrılan işlem kapasitesine göre tüketilir. İşlem birimi hareketsizlikte 5 dakika sonra uyuyabilir; sonraki bağlantı uyandırır. Kota ve planlar değişebilir.

Kaynak: [Neon fiyatlandırması](https://neon.com/pricing), [compute yaşam döngüsü](https://neon.com/docs/introduction/compute-lifecycle).

## 1. Hesap ve proje oluştur

1. [Neon Console](https://console.neon.tech/) adresine git ve hesap aç / giriş yap.
2. Ücretsiz planı kullan. **New Project** seç.
3. Proje adı olarak `pozitifai-portal` yaz.
4. Bölge olarak varsa Frankfurt gibi yakın bir Avrupa bölgesini seç. Mevcut seçeneklerden seçim yap; bölge listesini değiştirmek için başka bir hizmet açmak gerekmez.
5. Postgres sürümü seçimi görünüyorsa kararlı bir sürüm kullan; PostgreSQL 17 veya 18 uygundur. Beta / önizleme sürümü seçme.
6. Bu kurulumda **Postgres database** yeterlidir. Auth, Functions, Data API gibi ek servisler mevcut Django giriş sisteminin bir parçası değildir; bunları açmak gerekmez.
7. **Create project** ile projeyi oluştur.

Kaynak: [Neon proje oluşturma](https://neon.com/docs/manage/projects).

## 2. Bağlantı bilgilerini bul

Proje içindeki **Connect** düğmesini aç. Kullanacağın branch, database ve role seçili olsun. Varsayılan isimler çoğunlukla database için `neondb`, role için `neondb_owner` olur; ekranda gerçekten yazan değerleri kullan.

İlk kurulum ve bu küçük demo için **Connection pooling** seçeneğini kapatıp doğrudan bağlantıyı kullan. Host içinde `-pooler` bulunmayan adres seçilmiş olmalı. Bu seçim ek bağlantı havuzu ayarlarına ihtiyaç duymadan mevcut Django ayarlarıyla ilerlememizi sağlar.

Gerekli bilgiler:

| Neon bilgisi             | Portal ayarı                |
| ------------------------ | --------------------------- |
| Host                     | `PGHOST`                    |
| Database                 | `PGDATABASE`                |
| Role / User              | `PGUSER`                    |
| Password                 | Gizli girişten `PGPASSWORD` |
| Port                     | `PGPORT=5432`               |
| Şifreli bağlantı         | `PGSSLMODE=require`         |
| Bağlantı kimliği bağlama | `PGCHANNELBINDING=require`  |

Şifreyi veya şifre içeren bağlantı metnini sohbete, kaynak koduna veya GitHub'a yapıştırma. Bilgiler Django sunucusunda kullanılır; React tarafına ve `VITE_*` değişkenlerine konulmaz.

Kaynak: [Neon bağlantı bilgileri](https://neon.com/docs/connect/connect-from-any-app).

## 3. Proje klasöründe PowerShell aç

`start.bat`, `backend`, `frontend` klasörlerini gördüğün proje kökünde bir PowerShell terminali aç. Çalışan portal varsa kendi terminalinde `Ctrl+C` ile kapat. Yeni ayarlar çalışan sürece sonradan uygulanmaz.

Kurulu projede `.venv\Scripts\python.exe` bulunmalıdır. Henüz bağımlılıklar kurulmamışsa önce `npm start -- --prepare-only` ile yerel hazırlık yapılabilir; bu komut PostgreSQL ayarları verilmediyse SQLite kullanır.

## 4. Bağlantıyı bu terminal için tanımla

Bu bloğu PowerShell'e yapıştır. İlk üç soru Neon panelindeki açık bağlantı alanları içindir. Şifre sorulduğunda yazarken görünmez; şifre komut geçmişine yazılmaz.

```powershell
$env:PGHOST = Read-Host 'Neon Host'
$env:PGDATABASE = Read-Host 'Neon Database'
$env:PGUSER = Read-Host 'Neon Role / User'
$env:PGPORT = '5432'
$env:PGSSLMODE = 'require'
$env:PGCHANNELBINDING = 'require'
$env:PGCONNECT_TIMEOUT = '15'
$portalNeonPassword = Read-Host 'Neon veritabani sifresi' -AsSecureString
$env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $portalNeonPassword).Password
Remove-Variable portalNeonPassword
```

Host alanına yalnızca sunucu adını gir; `postgresql://...` bağlantı metninin tamamını girme. Database, Role ve Host alanlarını boş bırakma. Bu projede PostgreSQL seçimini `PGDATABASE` tetikler; boşsa uygulama SQLite'a döner.

Mevcut başlatıcı `.env` dosyasını otomatik okumaz. Dolayısıyla `.env` oluşturmak tek başına bu adımın yerine geçmez. `PGSSLMODE` ve `PGCHANNELBINDING` PostgreSQL sürücüsünün desteklediği ortam ayarlarıdır; ek paket kurulumu gerektirmez.

Kaynak: [PostgreSQL bağlantı ortam değişkenleri](https://www.postgresql.org/docs/current/libpq-envars.html).

## 5. Bağlantıyı doğrula

Aynı PowerShell penceresinde:

```powershell
.\.venv\Scripts\python.exe backend/manage.py shell -c "from django.db import connection; assert connection.vendor == 'postgresql', 'PostgreSQL secili degil; PGDATABASE degerini kontrol et'; connection.ensure_connection(); print('PostgreSQL baglantisi hazir')"
```

`PostgreSQL baglantisi hazir` mesajını görmeden sonraki adıma geçme. Bu komut tablo oluşturmaz; doğru motorun seçildiğini ve bağlantının açıldığını kontrol eder. Hata durumunda şifreyi paylaşmadan hata metnini incele.

## 6. Tabloları Django ile oluştur

Yeni, boş Neon veritabanı seçiliyken:

```powershell
.\.venv\Scripts\python.exe backend/manage.py upgrade_database
```

Komut, migration dosyalarındaki SQL işlemlerini PostgreSQL üzerinde uygular. Tablo, kolon, ilişki, indeks ve kısıtlar bu şekilde oluşur. Senin aynı tablolar için ayrıca `CREATE TABLE` yazman gerekmez. Bu kurulumda `makemigrations` çalıştırılmaz; mevcut migration dosyaları uygulanır.

Başarılı işlemden sonra:

```powershell
.\.venv\Scripts\python.exe backend/manage.py showmigrations portal
```

Uygulanan migration'lar `[X]` görünür. PostgreSQL üzerinde ilk çalıştırma henüz yapılmadığından bir uyumluluk hatası çıkarsa burada dur ve hatayı incele; `--fake`, tablo silme veya migration kayıtlarını elle değiştirme ile geçişi atlama.

Bu komut yeni şemayı kurar; bilgisayardaki SQLite hesaplarını ve kayıtlarını Neon'a taşımaz. Yerel dosya korunur. Mevcut hesapların aynen taşınması istenirse bu ayrı bir veri aktarımıdır.

## 7. Portalı başlat ve ilk admini oluştur

Aynı PowerShell penceresinde:

```powershell
npm start
```

Yeni veritabanında admin olmadığından başlatıcı ad soyad, e-posta ve şifre ister. Bu şifre portala giriş şifresidir; Neon veritabanı şifresiyle aynı olmak zorunda değildir. Sonrasında tarayıcıdan `http://localhost:5173/` adresine gir.

Ortam değişkenleri yalnızca bu PowerShell süreci ve buradan başlattığın süreçlerde geçerlidir. Pencereyi kapatıp Dosya Gezgini'nden `start.bat` dosyasına çift tıklarsan bu ayarlar aktarılmaz. Sonraki oturumda bu ayarları tekrar verip aynı terminalden başlat. Kalıcı ve tek komutlu cloud yapılandırması başlatıcı entegrasyonunda ayrıca tamamlanacaktır.

## 8. Tabloları tarayıcıda incele

Neon panelindeki **Tables** görünümünden tabloları incele. **SQL Editor** içinde aşağıdaki sorgu da tablo listesini verir:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Tablo adları Django nedeniyle `portal_call`, `portal_agent`, `portal_qualityscore` gibi görünür. Bir tablonun sütunlarını görmek için:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'portal_call'
ORDER BY ordinal_position;
```

Tablo yapısını panelden elle değiştirmek yerine yeni Django migration kullanılır; böylece kod ile veritabanı aynı şemayı tarif eder. Veritabanı role hesabı ile portalın Admin / Yönetici / Takım kaptanı rolleri farklı kavramlardır. Portal kullanıcılarına Neon şifresi verilmez.

Kaynak: [Neon Console ve Tables görünümü](https://neon.com/docs/get-started/signing-up).

## Sonraki uygulama adımı

[Kural kataloğundaki](data-quality-rules.md) uygulama farkları migration ile tamamlanacak. Ardından yetkili dosya yükleme, temizleme, sorun günlüğü ve iş tablolarına kayıt bağlanacak. Ham dosyalar ile işlem izleri ayrı yükleme kayıtlarında korunurken rapor tablolarına yalnızca kurallardan geçmiş alanlar yazılacak.
