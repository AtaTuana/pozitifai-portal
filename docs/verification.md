# Giriş ve planlama uyarlaması — doğrulama

27 Ekim 2026 tarihinde Windows, Node.js 24, Python 3.12 ve SQLite ile kontrol edildi.

## Otomatik kontroller

- Frontend TypeScript denetimi ve Vite üretim derlemesi başarılı.
- Perspektif düzeltmesinin 3 testi başarılı: referans ışın/düzlem denklemiyle eşlik, CSS ters dönüşümünün aynı konumu üretmesi ve yenileme hızından bağımsız takip.
- Django'nun 19 yetki, CSRF, oturum ve plan bütünlüğü testi başarılı.
- Django sistem denetimi temiz; bekleyen model/migration farkı yok.
- Prettier ve Black biçim kontrolleri başarılı.
- Yerel HTTP üzerinden anonim `/api/planning` isteği 401 döndü.
- Vite `@fs` üzerinden `.local/secret.key` ve backend ayar dosyasını isteme denemeleri 403 döndü. Gizli dosya içerikleri çıktıya alınmadı.

## Tarayıcıda kontrol edilen akışlar

Gerçek çalışma veritabanından ayrı, `.cache/qa-adaptation` dizinindeki örnek kayıtlarla denendi. Bu örnek hesaplar gerçek kurulumun parçası değildir; otomatik oluşturulmaz.

- Giriş, camın çalışma alanına genişlemesi, çıkış ve karta dönüş.
- Açık/koyu tema; 1440 px masaüstü ve 390 px mobil görünüm.
- Yeni perspektif WebGL ve zorlanmış CSS yedeğinde ayrıca kontrol edildi. 1440 px görünümde CSS logo sol kenarı sağa bakışta 440 px'den yaklaşık 407 px'ye kaydı; genişliği yaklaşık 560 px kaldı. Test sonrasında çizici `auto` durumuna döndürüldü. Bu konum denetimidir, FPS ölçümü değildir.
- Mobil menü, kullanıcı formunda rol seçimi ve kaptan için takım alanı.
- Kampanya oluşturma, takıma bağlama, geri al/yinele, kaydetme ve üst sekmeye yansıma.
- Harita düğümünü fareyle taşıma ve geri alma.
- Kaydedilmemiş değişiklikte sayfadan ayrılma koruması; taslağı bırakıp sunucudaki planı yükleme.
- Kaptan hesabında yalnız atanmış takım, temsilcisi ve kampanyaların görünmesi; düzenleme/hesap yönetimi araçlarının görünmemesi.
- Sayfa yenilemesinde oturum ve kaydedilmiş kayıtların korunması.
- Başlatıcının ayrı test portlarıyla Django ve Vite'yi birlikte açması.

Kullanıcı/parola değişikliğinin sunucu davranışı otomatik testlerle kontrol edildi; kullanıcının gerçek hesap veya parolası oluşturulmadı/değiştirilmedi. PostgreSQL, Opera GX, gerçek mobil cihaz, ekran okuyucu ve canlı HTTPS dağıtımı bu kontrolün kapsamı değildir. Raporlama/LLM/veri yükleme henüz uygulanmadığı için doğrulanmış kabul edilmez.

## Ortak tema ve dosya sekmesi düzeltmesi

Ayrı QA veritabanıyla masaüstü görünümde ilk kampanya x=244, sidebar sağ kenarı x=232 ölçüldü (12 px boşluk). Camın path sınırı kampanya çıkıntılarıyla tek kapalı şekildir. Geçişin ara karesinde sidebar, workspace ve kampanya yazılarının hesaplanmış rengi aynıydı. Açık/koyu görünümler ve tarayıcı hata kayıtları kontrol edildi; hata yoktu. Piksel bütçesinin azaltılması bir FPS ölçümü değildir; Opera GX üzerinde donmanın tamamen giderildiği iddia edilmez.

Sonraki katman düzeltmesi: navbar camı girişte kaldırıldı; arka üst cam ve çıkıntılı ön cam ayrı sıralandı, referansın ortak hareketi uyarlandı. Kullanıcının isteğiyle bu düzeltme için test, üretim derlemesi veya tarayıcı doğrulaması çalıştırılmadı. Yukarıdaki başarılı kontroller bu son değişikliği kapsamıyor.

## 28 Ekim 2026 — Veritabanı şeması

- Gerçek yerel SQLite veritabanına `0002` ve `0003` migration'ları uygulandı; önce tutarlı dosya yedeği oluşturuldu.
- Geçiş sonrası `PRAGMA integrity_check` sonucu `ok`, yabancı anahtar hatası sayısı 0.
- Mevcut admin hesabı ve parola hash'i yedekle karşılaştırılarak korunduğu doğrulandı. Önceki 34 işlem kaydı korundu, bir şema geçişi kaydı eklendi.
- Django sistem kontrolü ve migration/model eşleşmesi kontrolü geçti. TypeScript tip kontrolü geçti.
- Kullanıcının talebi doğrultusunda test paketi, tarayıcı testi veya performans testi çalıştırılmadı. Eski erişim testi fixture'ları yeni kimlik ve üyelik yapısına uyarlandı; bu değişiklikten sonra test sonuçları henüz yoktur.
- PostgreSQL bağlantısı üzerinden migration çalıştırılmadı; PostgreSQL doğrulaması yapılmış gibi değerlendirilmemelidir.

## 30 Ekim 2026 — Dosya yükleme ve veri temizleme

- Python kaynakları sözdizimi açısından ayrıştırıldı; Django sistem kontrolü `System check identified no issues (0 silenced).` sonucunu verdi.
- Migration/model eşleşmesi `makemigrations --check --dry-run --noinput` ile kontrol edildi: `No changes detected`.
- TypeScript tip kontrolü (`tsc --noEmit`) geçti.
- Kullanıcının isteğiyle test paketi, tarayıcı testi, üretim derlemesi veya veri yükleme senaryosu çalıştırılmadı. Bu kontroller, veri temizleme sonuçlarının ve UI davranışının uçtan uca doğrulandığı anlamına gelmez.
- Kullanıcı Neon'da önceki şemanın tablolarını gördüğünü doğruladı. Yeni `0004` migration'ı ve yükleyici bu oturumdan Neon'da çalıştırılmadı; bağlantı değişkenleri kullanıcının ayrı PowerShell oturumunda. Aynı terminalden portal yeniden başlatıldığında başlatıcı migration'ı uygular.
- Kaynak case belgeleri, CSV/TXT dosyaları ve kullanıcının `Report/` klasörü değiştirilmedi. Veri yükleme değişiklikleri ayrı `codex/data-imports` dalında commit edilmeden tutulur.

## 30 Ekim 2026 — Filtreli KPI hesaplama servisi

- Backend'e `GET /api/reports/kpis` ve arayüzden bağımsız ortak hesaplama servisi eklendi. Frontend dosyaları değiştirilmedi; yeni migration yok.
- Değişen/yeni Python kaynakları sözdizimi açısından ayrıştırıldı ve biçimlendirildi. Django sistem kontrolü `System check identified no issues (0 silenced).` sonucunu verdi.
- SQLite ve PostgreSQL için yönetici/kaptan kapsamlarıyla 48 özet, grup sayımı ve birleşik kırılım SQL sorgusu çevrimdışı derlendi. Kontrol sırasında bağlantı açma ve cursor çalıştırma engellendi; bu işlem SQL'in gerçek sunucuda çalıştırıldığı veya sonuçlarının doğrulandığı anlamına gelmez.
- İzole sentetik veriler için 11 test senaryosu yazıldı: paydalar ve eksikler, kaptan kapsamı, yerel tarih sınırları/saat, güncel takım/geçmişin çoğaltmaması, birleşik filtreler, kırılım sayfalaması, aynı adlı temsilciler, ağırlıklı ortalama, sıfır/boş ayrımı, ondalık kalite toplamı, geçersiz parametreler, oturum/yöntem sınırları ve yetki iptali.
- Kullanıcının önceki talebi doğrultusunda test paketi, tarayıcı testi veya gerçek rapor API isteği çalıştırılmadı. Test senaryoları yazılmış olmakla birlikte henüz yürütülmedi. Kullanıcının veritabanına, yüklenmiş verilerine veya kaynak dosyalarına işlem uygulanmadı.
