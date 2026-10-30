# Dosya yükleme ve temizleme

## Kullanım

1. Portalı PostgreSQL bağlantısının tanımlı olduğu terminalde `npm start` ile yeniden başlatın. Başlatıcı bekleyen `0004` migration'ını uygular. Yeni PowerShell penceresi PG değişkenlerini önceki pencereden devralmaz; [Neon kılavuzundaki](cloud-postgresql.md) bağlantı adımı gerekebilir.
2. Admin hesabıyla **Temsilciler → Temsilci kadrosu yükle** bölümünde `agents.csv` seçin. Bu işlem yalnızca dosyada adı geçen temsilcileri ekler/günceller; dosyada olmayanları silmez. Takım planı güncellenir.
3. **Veri yükleme → Çağrılar** bölümünde `calls.csv` yükleyin. Kaynak dönemini bağımsız olarak biliyorsanız isteğe bağlı tarih alanlarına girin. Bu dönem bir filtre değildir; yalnızca belirsiz tarih yorumlarına kanıt sağlar.
4. **Kalite değerlendirmeleri** bölümünde `quality_scores.csv` ve uygun puanlama profilini seçin. Bu case için Q1 v1: `0.25 × selamlama + 0.40 × ihtiyaç analizi + 0.35 × kapanış`. Başka bir kaynağa bu profil kanıtsız uygulanmamalıdır.
5. **Transkriptler** bölümünde klasörü veya birden fazla `.txt` dosyasını seçin. Dosya adı çağrı kimliği olmalı: `C100318.txt`. Metin korunur ve çağrıya bağlanır. Bu aşama LLM çağrısı yapmaz.
6. Yükleme geçmişindeki **İncele** düğmesi özet, kural filtresi ve alan bazında önce/sonra kayıtlarını açar. Ayrıntılar 50 işlem/sayfa; geçmiş 25 yükleme/sayfa olarak alınır.

Admin ve yönetici çağrı/kalite/transkript yükleyebilir ve yükleme geçmişini inceleyebilir. Kadro güncellemesi adminle sınırlıdır. Takım kaptanı yükleme API'sini, geçmişini veya ham dosyalarını göremez; doğrudan API isteği de sunucuda reddedilir.

## Saklanan veri

`ImportBatch`, özgün dosyanın baytlarını, SHA-256 değerini, ilk yükleyeni, kural sürümünü, seçilen profili/dönemi ve özeti tutar. `ImportRow`, kaynak satırı, temizlenmiş alanları, kimliği ve son durumu taşır. `ImportIssue`, sıralı kural kimliği/sürümü, işlemi yapan kişi/zaman, önceki/sonraki değer, kanıt ve rapor etkisini tutar. Normal hücreler için ayrı günlük kaydı üretilmez; biçim dönüşümleri ve sorunlar izlenir.

Raporların kullanacağı `Call`, `QualityScore` ve `Transcript` tabloları yalnızca uygun kayıtları alır. Tarihi, süresi, temsilcisi veya sonucu eksik bir çağrı, diğer alanları geçerliyse korunur. Tarihsiz çağrı için `started_at=NULL` kullanılır. Kalite yokluğunda sıfır puanlı bir satır oluşturulmaz. Kaptan kapsamı güncel kadroya göre belirlenir.

Her dosyanın iş kayıtları bir veritabanı savepoint'i içinde yazılır. Bilinen dosya veya veritabanı hatasında bu dosyanın iş kayıtları geri alınır; özgün dosya ve başarısızlık kaydı tutulur. Bağlantının tamamen kopması bütün dış transaction'ı da geri alabilir; böyle bir durumda kullanıcı geçmişi kontrol ederek yeniden deneyebilir. Bir klasördeki dosyalardan biri biçim hatası alırsa diğer geçerli dosyaların sonuçları ayrı gösterilir.

## Tekrar, çelişki ve geç eşleşme

- Aynı kimlik ve kaynak alanlarının tamamı aynıysa tek örnek kabul edilir. Farklı kimlikli benzer görüşmeler birleştirilmez.
- Aynı dosya içinde aynı kimlikte farklı kayıtlar varsa bütün çelişkili grup incelemeye ayrılır. Önceden kabul edilmiş kayıtla çelişen yeni veri eskisinin üzerine yazılmaz.
- Aynı dosya, tür, katalog sürümü, profil ve dönemle yeniden yüklendiğinde tamamlanmış yükleme yeniden kullanılır. Transkriptlerde dosya adındaki çağrı kimliği de bu anahtarın parçasıdır; aynı konuşma metninin farklı çağrılara ait olması mümkündür. Dosya satırları/çağrılar çoğalmaz. Profil veya dönem değiştirmek yeni değerlendirme girişimidir; mevcut kabul edilmiş kayıtların üzerine otomatik yazma yetkisi vermez.
- Kalite/transkript çağrıdan önce gelirse eşleşme bekler. Sonraki yüklemeler eksik ilişkileri yeniden değerlendirir. Çağrı eşleşse bile kalite tutarsızlığı varsa kalite rapora alınmaz.
- Çağrılar kadrodan önce gelirse temsilcileri NULL kalır. Kadro yüklendiğinde kaynak `temsilci_id` ile eşleştirilir, önceki yüklemenin özeti güncellenir ve eski eşleşme sorunu çözüldü olarak işaretlenir.
- Yeni yüklemenin desteklediği takım–kampanya ilişkileri plana eklenir. Mevcut açık plan taslakları sürüm kontrolüyle eski kalabilir; yeniden yüklenmelidir.

## Adlar ve kaynak biçimleri

UTF-8 ve UTF-8 BOM kabul edilir. CSV başlıkları gerekli sütunları içermeli; başlık tekrarı olmamalıdır. Virgül, noktalı virgül veya sekme ayıracı başlıklardan belirlenir. Hücre taşması, eksik/fazla sütun ve tırnak hatası sessizce atlanmaz. Tırnak bozukluğu güvenilir satır sınırını kaybettiriyorsa dosya bütünüyle durur.

Çağrı sonuçlarında Türkçe harflerin kısmen kullanıldığı yazımlar desteklenir: `ulasılamadı`, `ulaşılamadı`, `ULASILAMADI` ve `ULAŞILAMADI` bilinen `Ulaşılamadı` sonucuna eşleşir. Bu dönüşüm yalnızca sonuç sözlüğünde tanımlı etiketlere uygulanır; bilinmeyen kelimeler tahmin edilmez. Değişiklik `DQ-013 v2` olarak izlenir.

Takım, kampanya ve değerlendirici adları yalnızca standartlaştırılmış tam adla eşleştirilir; bulanık benzerlik kullanılmaz. Aynı ada birden fazla kayıt karşılık geliyorsa yönetici incelemesi gerekir. Yeni takım/kampanya adı 12 karakterlik iş kimliğine sığmıyorsa adın SHA-256 özetinden 11 karakter ve tür önekiyle kimlik üretilir; tam ad ayrı korunur, kaynak çağrı/temsilci kimliği türetilmez. Kimlik çakışması otomatik birleştirme sebebi değildir. Plan üzerinden varlık adı değiştirilmişse sonraki kaynağın eşleşmesi inceleme gerektirebilir; otomatik eski ad takma adı yönetimi bu sürümde yoktur.

Q1 toplamı yalnızca toplam açıkça eksik/geçersiz, üç alt puan geçerli olduğunda yeniden hesaplanır. Hesap `Decimal` ile yapılır; kayıt hassasiyeti iki ondalıktır. Kaynak toplamın bir ondalık yuvarlama toleransı en fazla 0.05 puandır; iki ondalıklı toplamda 0.005'tir. Aralık içindeki tutarsız bir toplam keyfî olarak düzeltilmez. Tek eksik alt puan için olası aralık gösterilir; kaynağın alt puan hassasiyeti bilinmediğinden otomatik bir sayı seçilmez.

## Mevcut boş çağrı sonuçlarını onarma

Katalog 1.0 ile yüklenen verilerde `ulasılamadı` gibi etiketler boş kalmış olabilir. Yeni kod gelecek yüklemeleri düzeltir; mevcut kabul edilmiş kayıtları yeniden yüklemek bunların üzerine yazmaz. Bütün tabloları silmek gerekmez. `repair_call_results`, saklanan kaynak satırı güncel sonuç eşleştirmesiyle okuyarak yalnızca sonucu hâlâ NULL olan, kaynağı kabul edilmiş çağrıları onarır. Dolu sonuçları, diğer çağrı alanlarını, kadroyu, kaliteyi ve transkriptleri değiştirmez. Kaynaktaki `???` için onarım yapmaz.

Proje kökünde, portalın kullandığı PostgreSQL bağlantı değişkenlerinin tanımlı olduğu **aynı PowerShell penceresinde** çalıştırın. Yeni pencerede PG değişkenleri yoksa varsayılan SQLite veritabanı kullanılır; [bağlantı kılavuzunu](cloud-postgresql.md) izleyin. Şifreyi komut satırı argümanına yazmayın.

Önce yalnızca önizleme:

```powershell
.\.venv\Scripts\python.exe backend\manage.py repair_call_results
```

Çıktıda çağrı kimliği, kaynak etiket ve hedef sonuç görünür. Bu komut kayıt değiştirmez. Uygulamak için `--actor` değerini portala girişte kullanılan mevcut admin e-postasıyla değiştirin:

```powershell
.\.venv\Scripts\python.exe backend\manage.py repair_call_results --apply --actor "admin-epostaniz"
```

Uygulama tek transaction içinde sonucu ve temizlenmiş alanı günceller, önceki DQ-013 eksikliklerini çözüldü işaretler, düzeltme kaydı ve işlem geçmişi oluşturur, ilgili yükleme özetlerini yeniler. İlk yüklemenin katalog sürümü ve özgün dosya/satır aynen kalır. İkinci çalıştırmada onarılmış dolu sonuçlar değişmez. Sonrasında yükleme geçmişini yenileyin.

Bu düzeltme yeni migration gerektirmez. Gelecek yüklemelerin yeni kuralı kullanması için çalışan backend'i yeniden başlatın. Onarım komutu kullanıcının veritabanına karşı otomatik çalıştırılmaz.

## Sınırlar ve sonraki aşama

Tek dosya en fazla 5 MB, istek toplamı 10 MB, CSV 20.000 veri satırı, transkript klasörü 50 dosyadır. Kaynak dosyalar sunucuda çalıştırılmaz veya dosya adından üretilen bir dizine yazılmaz. Frontend ve backend aynı sınırları kontrol eder; CSRF ve oturum kontrolleri korunur.

Yükleme senkron çalışır; kullanıcı sonucunu aynı istekten alır. İstemci 120 saniye yanıt bekler. Yanıt kaybolması sunucu işleminin iptal edildiği anlamına gelmez; önce geçmiş yenilenmelidir. Büyük üretim yükleri için arka plan iş kuyruğu bu sürümün kapsamı dışındadır.

KPI hesaplama servisi bu akışın kabul ettiği çağrı/kalite kayıtlarını kullanır; tarih, süre ve kalite eksikliği kuralları sorgularda uygulanır. [Filtreli rapor API'si](reporting-api.md) dashboard gösteriminden bağımsızdır. [Excel çıktısı](excel-report.md) kabul edilen kayıtları kullanır; [ret analizi](rejection-analysis.md) ayrıca kullanıcı isteğiyle başlatılır. Doğrulama sınırları için [verification.md](verification.md) dosyasına bakın.
