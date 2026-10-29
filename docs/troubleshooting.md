# Başlatma ve görünüm sorunları

| Kod         | Anlamı                                       | Yapılacak işlem                                                                                                                          |
| ----------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| START001    | Node.js eksik veya sürümü eski               | Node.js 24 LTS kurun; terminali kapatıp `start.bat` dosyasını yeniden açın.                                                              |
| START002    | npm veya paket kurulumu başarısız            | İnternet bağlantısını ve terminaldeki npm hata mesajını kontrol edin. Node.js kurulumunda npm bulunduğundan emin olun; tekrar başlatın.  |
| START003    | Seçilen port kullanılamıyor                  | Önceki portal terminalini Ctrl+C ile durdurun. Alternatif olarak PowerShell'de `$env:PORT=5174` yazıp `npm start` çalıştırın.            |
| START004    | Port veya başlatıcı seçeneği geçersiz        | Port için 1024–65535 arası bir tam sayı kullanın. Seçenekler yalnızca `--no-open` ve `--prepare-only` olabilir.                          |
| START005    | Geliştirme sunucusu başlatılamadı veya durdu | Üstteki asıl hata mesajını kontrol edin. Proje kökünde `npm ci`, ardından `npm start` çalıştırın.                                        |
| GL000–GL004 | Gelişmiş cam çizimi kullanılamıyor           | CSS cam ve perspektif görünümü otomatik çalışır. GL003, WebGL 2 bağlamı açılamadığını belirtir; aşağıdaki tarayıcı kontrolünü uygulayın. |
| GL005–GL006 | Logo dokusu oluşturulamadı veya yüklenemedi  | `frontend/public/assets/logo.svg` dosyasının bulunduğunu kontrol edin; proje dosyalarını eksiksiz çıkarıp sayfayı yenileyin.             |

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
