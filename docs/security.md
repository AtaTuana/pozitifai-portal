# Güvenlik kapsamı

Bu belge uygulanmış denetimleri ve yerel sunumun sınırlarını tanımlar; sızma testi raporu veya zafiyetsizlik garantisi değildir.

## Kimlik ve yetki

- Parolalar Django'nun varsayılan PBKDF2 hasher'ı ile tuzlanarak saklanır. Düz metin şifre, istek gövdesi, çerez ve CSRF değeri işlem günlüğüne yazılmaz.
- İlk admin sadece yerel terminalden oluşturulur. Anonim kayıt API'si ve hazır admin parolası yoktur. Veritabanı ikinci admini engeller.
- Oturumlar sunucuda tutulur. Tarayıcıda HttpOnly ve SameSite=Strict oturum çerezi bulunur; erişim token'ı localStorage'a yazılmaz.
- POST/PATCH/PUT işlemleri, giriş dahil, Django CSRF denetimine tabidir. İstemci CSRF değerini `/api/session` yanıtından alıp bellekte tutar.
- Yetki sunucuda denetlenir. Takım kaptanına yalnız kendi takımı, temsilcileri ve bağlantılı kampanyaları döner. Paylaşılan kampanya diğer takımın bağlantılarını açmaz. Plan/kullanıcı yönetimini yalnız admin yapar. Yönetici çağrı, kalite, transkript yükleyebilir ve analiz başlatabilir; kaptan bu işlemleri yapamaz. Kaptan takım planlama API’sini de kullanamaz. İlgili rol sınırları arayüz dışından gönderilen isteklerde de uygulanır.
- Hesap/rol değişikliği ve parola değişikliği mevcut parola doğrulaması ister. Rol, takım, etkinlik veya parola değişikliği `auth_version` artırır; eski oturumlar sonraki istekte iptal edilir.
- Oturum 30 dakika işlem yapılmadığında veya girişten 8 saat sonra sona erer. Çıkış sunucudaki oturumu sonlandırır.
- Giriş ve hassas doğrulamalar 15 dakikada hesap başına 10, bağlantı IP'si başına 60 denemeyle sınırlanır. Hatalı hesap/şifre aynı genel mesajı üretir. Limit anahtarları HMAC özetidir. Yerel Vite proxy'sinde API istemcileri loopback olarak görür; IP sınırı bu kurulumda ortaktır. Canlı dağıtımda güvenilir proxy zinciri ayrıca tasarlanmalıdır.

## Bütünlük ve işlem günlüğü

Plan tek veritabanı işlemi içinde kaydedilir. Kayıt türü, kimliği, kod benzersizliği, bağlantı yönü ve temsilcinin tek takıma üyeliği doğrulanır. Sürüm uyuşmazlığında eski sekmenin kaydı 409 ile reddedilir. Kaldırılan organizasyon kayıtları arşivlenir. Kaptanı bulunan takımın kaldırılması engellenir.

Giriş/çıkış, başarısız doğrulama, yetkisiz işlem, kullanıcı/profil/parola değişikliği ve plan görüntüleme/kaydetme olayları `AuditEvent` içinde zaman ve aktörle tutulur. Plan değişikliğinin önce/sonra kayıtları saklanır. Admin ekranı son 200 olayın özetini gösterir. Bu uygulama günlüğüdür; her fare hareketini toplayan telemetri veya değiştirilemez merkezi denetim deposu değildir. Veri yükleme, rapor hesaplama/indirme ve ret analizi kendi iş olaylarını üretir. Temizleme ayrıntıları ayrı `ImportIssue` kayıtlarında tutulur; uygulama günlüğü bütün ham konuşmayı kopyalamaz.

## Dosyalar ve ağ

Windows başlatıcısı eksik bağlantı/API bilgilerini gizli girişle alır. `.local/runtime.json` bilgisayarda kalan, Git tarafından dışlanan ayar dosyasıdır; şifreli bir kasa değildir. Paylaşılmamalıdır. Gerçek ayarlar `.env.example` içine yazılmaz; bu örnek dosya otomatik yüklenmez. Başlatıcı ilk açılışta ücretli API denemesi yapmaz.

API loopback üzerinde Waitress ile çalışır; `DEBUG=False` kullanılır. Tarayıcı aynı kökenden erişir; genel CORS izni yoktur. Vite dosya izin listesi frontend ve node_modules ile sınırlıdır. Backend, `.local`, `.venv`, `.git`, `.env` ve anahtar dosyaları HTTP üzerinden sunulmaz.

API yanıtlarında `no-store`, `nosniff`, frame engeli ve kısıtlı CSP kullanılır. Geliştirme arayüzünün CSP'si Vite/React ve dinamik stiller nedeniyle `unsafe-inline` içerir; bu üretim için sıkı CSP değildir. React kullanıcı metinlerini HTML olarak yorumlamaz; kullanıcı verisi `innerHTML` ile eklenmez.

Yerel ağ HTTP sunumu trafiği şifrelemez. Canlıya açmadan HTTPS, Secure çerezler (`PORTAL_HTTPS=1`), izinli alan adları, reverse proxy, yedekleme, günlük saklama politikası, bağımlılık takibi ve üretim derlemesi ele alınmalıdır. Bu sürüm için internet yayını yapılmamıştır.

## Doğrulama

`backend/portal/tests/` gerçek CSRF denetimini açık tutar. Testler anonim erişim, yabancı Origin, çerez nitelikleri, oturum iptali, rol kapsamı, yeniden parola doğrulaması, parola hash'i, giriş limiti, ilişkisel plan bütünlüğü ve çakışan plan sürümlerini kapsar. SQLite üzerinde çalıştırılır; PostgreSQL ve gerçek üretim altyapısı ayrıca doğrulanmalıdır.

Referans: [Django güvenliği](https://docs.djangoproject.com/en/5.2/topics/security/), [CSRF](https://docs.djangoproject.com/en/5.2/howto/csrf/), [oturum ve kimlik doğrulama](https://docs.djangoproject.com/en/5.2/topics/auth/default/).
