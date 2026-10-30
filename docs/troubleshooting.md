# Başlatma ve görünüm sorunları

| Kod         | Anlamı                                       | Yapılacak işlem                                                                                                                                                                |
| ----------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| START001    | Node.js eksik veya sürümü eski               | Node.js 24 LTS kurun; terminali kapatıp `start.bat` dosyasını yeniden açın.                                                                                                    |
| START002    | npm veya paket kurulumu başarısız            | İnternet bağlantısını ve terminaldeki npm hata mesajını kontrol edin. Node.js kurulumunda npm bulunduğundan emin olun; tekrar başlatın.                                        |
| START003    | Seçilen port kullanılamıyor                  | Önceki portal terminalini Ctrl+C ile durdurun. Alternatif olarak PowerShell'de `$env:PORT=5174` yazıp `npm start` çalıştırın.                                                  |
| START004    | Port veya başlatıcı seçeneği geçersiz        | Port için 1024–65535 arası bir tam sayı kullanın. Node başlatıcısında `--no-open`, `--prepare-only`; Windows başlatıcısında ayrıca `--configure`, `--check-tools` desteklenir. |
| START005    | Geliştirme sunucusu başlatılamadı veya durdu | Üstteki asıl hata mesajını kontrol edin. Proje kökünde `npm ci`, ardından `npm start` çalıştırın.                                                                              |
| GL000–GL004 | Gelişmiş cam çizimi kullanılamıyor           | CSS cam ve perspektif görünümü otomatik çalışır. GL003, WebGL 2 bağlamı açılamadığını belirtir; aşağıdaki tarayıcı kontrolünü uygulayın.                                       |
| GL005–GL006 | Logo dokusu oluşturulamadı veya yüklenemedi  | `frontend/public/assets/logo.svg` dosyasının bulunduğunu kontrol edin; proje dosyalarını eksiksiz çıkarıp sayfayı yenileyin.                                                   |

Windows'ta normal açılış `start.bat` üzerinden program kontrolü/kurulumu ve eksik Neon/API ayar sorularını otomatik yapar. Aşağıdaki START001/START006 elle kurulum adımları otomatik kurulumun engellendiği durumlar içindir.

| Kod      | Anlamı / çözüm                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| START010 | WinGet hazırlanamadı. İnterneti ve kurum izinlerini kontrol edin. Gerekirse Microsoft App Installer kurulumunu tamamlayıp yeniden açın.                            |
| START011 | Node/Python kurulumu başarısız veya yeniden başlatma gerekiyor. Terminaldeki paket yöneticisi mesajını kontrol edin; Windows izin penceresini onaylayın.           |
| START012 | Neon Host alanı geçersiz. Tam bağlantı URL'si veya psql komutu yerine yalnız sunucu adını girin; `start.bat --configure` ile düzeltin.                             |
| START013 | Windows başlatıcısı tamamlanamadı. Klasör erişimi, Windows politikaları ve interneti kontrol edin. Kurum politikasını devre dışı bırakmayın.                       |
| DB008    | PostgreSQL bağlantısı doğrulanamadı. Neon erişimini/bağlantı bilgilerini kontrol edin; `start.bat --configure` ile yeniden girin. Otomatik SQLite geçişi yapılmaz. |

Başlatma hataları terminalde, API hataları ilgili formda koduyla, grafik tanıları tarayıcı konsolunda gösterilir. Grafik hatasında temel cam görünümü korunur.

## Giriş, backend ve planlama

| Kod             | Anlamı / çözüm                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| START006        | Python 3.11–3.14 bulunamadı. Python 3.12 kurun veya `PORTAL_PYTHON` ile çalıştırılabilir dosyasını seçin.            |
| START007        | Python paketleri, migration veya ilk admin hazırlığı başarısız. Terminaldeki asıl hata ve SETUP kodunu kontrol edin. |
| START008        | Django başlamadı. `API_PORT` kullanımını ve üstteki hata mesajını kontrol edin.                                      |
| SETUP001        | İlk admin oluşturma yarıda kaldı. `start.bat` dosyasını yeniden açın.                                                |
| SETUP002        | Admin adı, e-postası veya şifresi geçersiz. En az 12 karakterli güçlü ve eşleşen şifre kullanın.                     |
| AUTH001         | Oturum sona erdi veya yetki değişti. Yeniden giriş yapın.                                                            |
| AUTH002         | E-posta veya şifre hatalı. Giriş bilgilerini kontrol edin.                                                           |
| AUTH003         | Rolünüz işlemi yapamıyor. Admin hesabıyla ilgili işlemi gerçekleştirin.                                              |
| AUTH004         | CSRF doğrulaması başarısız. Sayfayı yenileyin; adres/alan adını değiştirdiyseniz tekrar giriş yapın.                 |
| AUTH005         | Deneme sınırı aşıldı. 15 dakika bekleyin.                                                                            |
| AUTH006         | Hassas işlem için kendi mevcut şifrenizi doğru yazın.                                                                |
| AUTH007         | Tek adminin rolü veya etkinliği değiştirilemez.                                                                      |
| VAL001–VAL005   | Form alanını mesajdaki kurala göre düzeltin; kaptan için etkin takım seçin.                                          |
| DATA001         | E-posta veya kayıt kodu kullanımda. Arşivlenmiş kayıtta da kod korunur; farklı kod seçin.                            |
| DATA002         | Kayıt bulunamadı. Sayfayı yenileyin.                                                                                 |
| PLAN001–PLAN005 | Kayıt/bağlantı biçimi geçersiz veya yineleniyor. Kodu ve bağlantı yönünü kontrol edin.                               |
| PLAN006         | Bir temsilciye birden fazla takım atanmış. Tek takım bırakın.                                                        |
| PLAN007–PLAN008 | Sekmedeki sürüm eski. Gerekli değişiklikleri not alıp taslağı bırakın, güncel planı yükleyin ve yeniden uygulayın.   |
| PLAN009         | Takımı kaldırmadan önce bağlı kaptanların takım atamasını değiştirin.                                                |
| PLAN010         | Mevcut kaydın türünü değiştirmeyin; yeni türde kayıt oluşturun.                                                      |
| REQ001–REQ003   | API istek biçimi veya HTTP yöntemi geçersiz. Normal arayüzde tekrarlanırsa hata kodunu bildirin.                     |
| NET001–NET002   | Sunucu bağlantısı veya yanıtı başarısız. Başlatıcı terminalini ve ağ bağlantısını kontrol edip yeniden deneyin.      |

**Giriş ekranında API hatası:** `npm run dev` sadece arayüzü açar. Eski terminali Ctrl+C ile durdurun; Django'yu da başlatan `start.bat` / `npm start` kullanın.

**npm EPERM / kilitli dosya:** Çalışan geliştirme sunucusunu durdurun; sonra `npm ci` ve `npm start` çalıştırın. Yönetici hesabı açmak veya güvenlik yazılımını kapatmak gerekmez.

**Şifre terminalde görünmüyor:** İlk admin kurulumunda normal davranıştır. Yazıp Enter'a basın. Hazır admin şifresi yoktur.

## Opera GX: WebGL kullanılamıyor

`npm install -g react-devtools` bu sorunu çözmez. React Developer Tools, bileşenleri ve performansı incelemek için isteğe bağlı bir geliştirici aracıdır; WebGL'yi etkinleştirmez. [React dokümantasyonu](https://react.dev/learn/react-developer-tools).

1. **Alt+P** ile Opera ayarlarını açın. Ayarlar içindeki aramada **grafik hızlandırma** (İngilizce arayüzde **graphics acceleration**) arayın.
2. **Kullanılabilir olduğunda grafik hızlandırmayı kullan** seçeneği kapalıysa açın. Opera yeniden başlatma isterse açık işlerinizin kaydedildiğinden emin olup yeniden başlatın.
3. Portala dönüp sayfayı yenileyin. Uyarı devam ederse Opera ve ekran kartı sürücüsünün güncelliğini kontrol edin. Ayarın açık olması tek başına WebGL 2'nin çalışacağını garanti etmez. [Opera yardım sayfası](https://help.opera.com/en/faq/).

Bu adımlar genel kontroldür; kullanıcının tarayıcı/GPU tanısı incelenmeden kesin neden belirlenemez. WebGL açılamasa da tema geçişi, CSS cam ve aynı uzaklık/paralaks hesabı çalışır; su izi ve shader kenar kırılmaları WebGL 2 gerektirir. `visual.config.ts` içindeki `performance.renderer` normalde `auto` olmalıdır. `perspective.enabled: false` veya işletim sistemindeki hareket azaltma tercihi perspektifi bilinçli olarak durdurur.

**Sayfa açılmıyor:** Terminal kapanmışsa `start.bat` ile yeniden açın. Varsayılan adres `http://localhost:5173/` olmalıdır; `index.html` dosyasına doğrudan çift tıklamak uygulamayı başlatmaz.

**Başka cihazdan erişilemiyor:** İki cihaz aynı yerel ağda olmalıdır. Diğer cihazda `localhost` yerine sunucunun terminalde yazan Network adresini kullanın. VPN, misafir ağı veya güvenlik duvarı bağlantıyı engelleyebilir.

**Kurulum yolu değişti:** Proje kendi konumunu otomatik bulur. Yol düzenlemek gerekmez. Bağımlılık klasörü taşınırken eksik kopyalandıysa proje kökünde `npm ci` çalıştırın.

## Veritabanı geçişi

- `DB001`: Desteklenmeyen veritabanı motoru. SQLite veya PostgreSQL kullanın.
- `DB003`: Portal tablolarına beklenmeyen başka bir uygulama bağlı. Geçiş genişletilmeden uygulanmaz.
- `DB004`: UUID dönüşümü otomatik geri migration desteklemez. Eski kod ve geçiş öncesi veritabanı yedeği birlikte geri yüklenir.
- `DB005`: Eski iş kodları yeni kimliklerde çakışıyor. Kimlik eşleştirmeleri incelenmelidir; kayıtlar kesilmez.
- `DB006`: Geçişte kayıt veya parola özeti uyuşmadı. Atomik geçiş geri alınır.
- `DB007`: SQLite yedeği alınamadı/doğrulanamadı. Disk alanını ve dosya izinlerini kontrol edin.
- `TEAM001`: Üyelik bitişi başlangıçtan sonra olmalı.
- `TEAM002`: Takım üyeliği dönemleri çakışıyor. Var olan dönem kapanmadan yeni dönem açılamaz.

Şema geçişinden sonra eski oturumlar kapanır. Portalı `start.bat` ile yeniden başlatıp mevcut e-posta ve şifreyle giriş yapın. Planlama kimlikleri değiştiği için açık eski sekmeyi yenileyin. Kayıt kimliği en fazla 12 karakterdir ve oluşturulduktan sonra sabittir.

## Dosya yükleme

| Kod           | Yapılacak işlem                                                                                                                                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IMP001        | Dosyayı portalın uygun yükleme alanından gönderin; türü/istek biçimi geçersiz.                                                                                                                                                                                 |
| IMP002        | CSV için tek `.csv`; transkript için en fazla 50 `.txt` seçin. Transkript adı çağrı kimliği olmalı.                                                                                                                                                            |
| IMP003        | Tek dosya 5 MB, toplam istek 10 MB, CSV 20.000 veri satırı sınırını aşmış olabilir. Kaynağı bölerek yükleyin.                                                                                                                                                  |
| IMP004        | Transkript boş; konuşma içeren özgün TXT dosyasını seçin.                                                                                                                                                                                                      |
| IMP005        | Kalite profilini veya isteğe bağlı kaynak döneminin iki tarihini kontrol edin.                                                                                                                                                                                 |
| IMP006        | Geçmişi yenileyin; istenen yükleme, sayfa veya kural numarası geçersiz.                                                                                                                                                                                        |
| IMP007        | Aynı ada birden fazla varlık veya kimlik çakışması var. Planlamadaki adları inceleyin; benzerlik üzerinden otomatik birleştirme yapılmaz.                                                                                                                      |
| IMP008        | Veritabanı bağlantısını ve migration durumunu kontrol edin. Windows’ta kayıtlı ayarlarla `start.bat` üzerinden yeniden başlatın; bağlantı bilgisi değiştiyse `start.bat --configure` kullanın. Önce geçmişi yenileyin; gerekirse aynı dosyayla tekrar deneyin. |
| DQ-001        | Özgün kaynağı doğru kodlamayla UTF-8 CSV/TXT olarak yeniden dışa aktarın. Kayıp karakterler tahminle doldurulmaz.                                                                                                                                              |
| DQ-002        | CSV başlıklarını, sütun sayısını, tırnakları ve ayıracı kontrol edin. Kalite dosyası noktalı virgülle ayrılabilir.                                                                                                                                             |
| DQ-005–DQ-021 | Bunlar satır kararlarının katalog kimlikleridir. Yükleme geçmişindeki **İncele** alanında önce/sonra, gerekçe ve rapora etkisini okuyun; her kayıt uygulama hatası değildir.                                                                                   |

**Yanıt gelmedi fakat dosya işlendi mi?** Ağ zaman aşımı sunucunun işlemi iptal ettiği anlamına gelmez. Yükleme geçmişini yenileyin. Aynı dosya aynı seçeneklerle yeniden gönderildiğinde tamamlanmış kayıt yeniden kullanılır.

**Kalite eşleşme bekliyor:** Önce ilgili çağrıları yükleyin. Sonraki yükleme bekleyen ilişkileri tekrar kontrol eder. Çağrı eşleşse bile puan tutarsızlığı varsa bu sorun ayrıca görünür.

**Yükleme alanı görünmüyor:** Takım kaptanı yükleyemez. Çağrı/kalite/transkript için admin veya yönetici; temsilci kadrosu için admin gerekir.

**HTTP 413 / dosya çok büyük:** Portalın tek dosya/toplam sınırlarına uyun. Araya ek bir proxy konduysa onun istek sınırı da dosyayı engelleyebilir.

## Excel raporu

| Kod           | Anlamı / çözüm                                                                                                                                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XLS001        | Rapor şablonu okunamıyor, yapısı değişmiş veya Excel'in desteklemediği bir tarih var. Mesajı inceleyin; `backend/portal/reporting/templates/report.xlsx` dosyasını proje sürümünden geri yükleyin. Kaynak veriye tahmini tarih yazmayın. |
| XLS002        | Yetkili veri kapsamı 50.000 çağrı sınırını aşıyor. İndirme tüm yetkili veriyi içerdiğinden portal filtresini daraltmak çözmez; dışa aktarma sınırı ve kapasitesi artırılmalıdır.                                                         |
| XLS003        | İndirme bağlantısı kesildi, zaman aşımına uğradı veya yanıt Excel dosyası değil. Portal terminalini kontrol edip yeniden deneyin.                                                                                                        |
| RPT001–RPT002 | Rapor filtreleri geçersiz. Seçimleri ve tarih aralığını kontrol edin.                                                                                                                                                                    |
| RPT003        | Veritabanı sorgusu başarısız. Windows’ta kayıtlı Neon ayarlarıyla `start.bat` üzerinden başlatın; gerekirse `start.bat --configure` ile bağlantıyı düzeltin.                                                                             |

**Excel sayıları güncellenmiyor:** Hesaplama Seçenekleri'ni Otomatik yapın. Elle veri eklediyseniz kayıtların `ReportData` tablosuna dahil olduğundan ve Call Start'ın gerçek Excel tarihi olduğundan emin olun. Yeni veri eski filtre seçimini içermiyorsa filtreleri ilk seçeneklerine döndürün. [Rapor kullanımı](excel-report.md).

## Yerel ayarlar ve API bağlantısı

- `START009`: `.local/runtime.json` okunamadı, biçimi geçersiz veya kaydedilemedi. Dosya iznini ve JSON biçimini kontrol edin; dosyanın gizli içeriğini paylaşmayın.
- `LLM001`: API anahtarı bulunamadı. Windows’ta `start.bat --configure` ile anahtarı gizli sorudan girin. Terminal değişkenlerini elle yöneten geliştiriciler `npm run setup:local` kullanabilir.
- `LLM002`: Anahtarda boşluk veya geçersiz karakter var; güncel anahtarı yeniden girin.
- `LLM003`: API bağlantısı/yanıtı başarısız veya zaman aşımı. İnternet bağlantısını kontrol edin. Otomatik tekrar yapılmaz.
- `401 / token_invalidated`: Kimlik doğrulama reddedildi; bu sonuç model veya kredi kontrolü değildir. Güncel API anahtarını tekrar tanımlayıp kaydedin. Terminaldeki eski değer kayıtlı dosyadan önce gelir; yeni kaydı kullanmak için yeni bir terminal açın veya eski `OPENAI_API_KEY` ortam değişkenini kaldırın.
- `429`: `api_error_code` kredi/harcama sınırı ile istek sıklığı sınırını ayırır. Hata çözülmeden aynı isteği tekrarlamayın.

Adımlar: [Yerel ayarlar](local-settings.md).

## Ret analizi ekranı

| Kod           | Açıklama ve işlem                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| LLM001        | Anahtar backend’e yüklenmemiş. Portalı durdurup `start.bat --configure` ile anahtarı girin ve yeniden başlatın.            |
| LLM101        | OpenAI anahtarı veya erişim reddedildi. Güncel anahtarı ve proje/model izinlerini kontrol edin. Portal oturumu açık kalır. |
| LLM102        | Sağlayıcı kotası/hız/kredi sınırı. OpenAI faturalama ve limitlerini kontrol edip bekleyin.                                 |
| LLM103        | Model isteği başarısız. Model erişimini ve ayarını kontrol edin.                                                           |
| LLM104        | Tamamlanmış ve geçerli kategori yanıtı alınamadı. Kayıt başarı sayılmaz; yeniden deneyebilirsiniz.                         |
| LLM105        | Sağlayıcı yanıtı zaman aşımına uğradı. Bağlantıyı kontrol edin.                                                            |
| LLM106        | Model sınıflandırmayı reddetti. Konuşmayı kontrol edin; kategori uydurulmaz.                                               |
| LLM107        | Tek konuşma 60.000 karakter sınırını aşıyor. Yanlış dosya/birleştirme olmadığını kontrol edin.                             |
| LLM108        | Prompt sürümü veya kategoriler kayıtlı sürümle uyuşmuyor. Prompt değişikliğinde sürümü artırın.                            |
| REJ001        | Konuşma bulunamadı veya seçili tarih/kampanya/yetki kapsamında değil.                                                      |
| REJ002        | 1.000 konuşma sınırı aşıldı. Tarih aralığını daraltın.                                                                     |
| REJ003–REJ004 | Aynı konuşma veya üç paralel işlem zaten çalışıyor. Tamamlanmasını bekleyip sonuçları yenileyin.                           |
| REJ005        | Konuşma analiz sırasında güncellendi. Güncel metinle yeniden analiz edin.                                                  |
| REJ006        | Filtre biçimi geçersiz. Tarih ve kampanya seçimini yeniden yapın.                                                          |
| REJ007        | Veritabanı kaydına erişilemedi. Bağlantıyı kontrol edip sonuçları yenileyin; API işlemi bitmiş olabilir.                   |
