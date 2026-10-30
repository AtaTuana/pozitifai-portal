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

## 30 Ekim 2026 — Filtreli dashboard

- Altı widget içinde toplam/ulaşılan çağrı, ulaşma/dönüşüm oranı, konuşma süresi, toplam/alt kalite puanları ve saatlik yoğunluk bağlandı. Kampanya sekmeleri mevcut iş kimliğini gönderir; takım, temsilci ve tarih filtreleri aynı KPI API'sini kullanır.
- `tsc --noEmit` ve Django sistem kontrolü başarılı. Kalite alt puanlarını içeren 48 özet/kırılım SQL sorgusu SQLite ve PostgreSQL için bağlantı açmadan derlendi.
- Eksik alt kalite puanlarının bağımsız paydası, sıfır puanın geçerliliği ve kaptan kapsamı için bir test senaryosu eklendi; kullanıcının talebi doğrultusunda yürütülmedi.
- Test paketi, üretim derlemesi, gerçek rapor isteği, tarayıcı/görsel kontrolü veya FPS ölçümü çalıştırılmadı. Bu nedenle animasyonların belirli cihazdaki akıcılığı doğrulanmış kabul edilmez.
- Kaynak CSV/TXT/PDF dosyaları, veritabanı kayıtları ve `Report/` değiştirilmedi. Backend değişikliğinin yüklenmesi için çalışan portal sürecinin yeniden başlatılması gerekir; migration gerekmez.

## 30 Ekim 2026 — Formüllü Excel raporu

- Kullanıcının isteğiyle `Report/schematic.xlsx` formüllerle güncellendi; uygulamanın taşınabilir şablonu `backend/portal/reporting/templates/report.xlsx` içine alındı. Summary'nin özgün sütun ölçüleri, birleştirmeleri, yazı tipleri, dolguları, kenarlıkları ve sayfa ayarları XML düzeyinde karşılaştırılarak korundu. Hesaplanmış geçici örneğin görsel önizlemesi incelendi.
- Kurulu Excel 16.0 build 19127'nin ayrı, görünmeyen bir örneğinde geçici çalışma kitapları kullanıldı. Gerçek açık dosyalara veya veritabanına işlem yapılmadı. Toplam/ulaşılan/belirsiz sayıları, ulaşma/dönüşüm oranları, sıfır/boş süre ayrımı, bağımsız kalite paydaları ve saatlik sayımlar bilinen altı satırlık örneğe karşı doğrulandı; formül hatası bulunmadı.
- 2024, 2025, 2026 ve 2028 tarihleri, 29 Şubat sınırı, tarihsiz kayıtların dışlanması ve boş filtre kesişimi kontrol edildi. Yeni Excel tablo satırının yardımcı formülleri ve seçim listelerini büyüttüğü; 31.12.2099 23:59:59 kaydının o günün filtresine dahil olduğu doğrulandı. Türkçe Excel'in TEXT tarih biçimi farkı, gün/ay/yılı sayısal parçalarla birleştirerek giderildi.
- Formüller Excel 2016 işlev kümesiyle sınırlı tutuldu; dinamik dizi veya makro yoktur. Kontrol edilen kurulumun sürüm numarası 16.0'dır; ayrıca bağımsız, sabit bir Excel 2016 kurulumu üzerinde kontrol yapılmış sayılmaz. Önizleme motorunun bazı yapılandırılmış başvuruları değerlendirememesi nedeniyle hesap doğrulaması yerel Excel'de, görsel kontrolü onun hesapladığı değerlerle yapıldı.
- Django sistem kontrolü ve TypeScript tip kontrolü başarılı. Git diff biçim kontrolü hata vermedi. Test paketi, tarayıcıdan gerçek dosya indirme, üretim derlemesi veya Neon veri sorgusu yürütülmedi; uçtan uca indirme ve yük altındaki performans henüz doğrulanmış değildir.
- Kaynak Documents dosyaları ve veritabanı kayıtları korunur; migration, commit veya push yapılmadı.

## 30 Ekim 2026 — Excel'de değiştirilebilir varsayılan filtreler

- İndirme, dashboard filtrelerini RawData kapsamından ayırır: RawData tüm yetkili çağrıları içerir; dashboard seçimleri yalnızca Summary'nin dört filtre hücresine yazılır. Rol kapsamı mevcut `selected_calls` üzerinden uygulanır; takım kaptanı için başka takımlar dosyaya eklenmez. Sonuç hücreleri formül olarak kalır.
- Ayrı, geçici Excel kopyasında altı çağrının tamamı korunurken varsayılan takım/temsilci/kampanya/tarih aralığıyla bir çağrı gösterildi. Filtreleri sıfırlamak altı çağrıyı; başka takım seçmek iki çağrıyı gösterdi. Yalnız başlangıç, yalnız bitiş, aralık ve geçersiz/ters tarih girişleri kontrol edildi. Doğru girişlere dönüldüğünde formül hatası yoktu. Başlangıç tarihi değiştirilemeyen gizli bir kısıt olarak bırakılmadı.
- Varsayılan tarih aralığının mevcut kutuya sığdığı ve Summary yerleşiminin korunduğu görsel önizlemede kontrol edildi. Kaynak belgeler/veritabanı değiştirilmedi; test paketi veya tarayıcıdan gerçek indirme yürütülmedi.
- Son kullanıcı kontrolü: eski backend süreci Excel adresine 404 döndürüyordu. Backend yeniden başlatıldıktan sonra kullanıcı portal üzerinden Excel dosyasını başarıyla indirdiğini doğruladı.

## 30 Ekim 2026 — Ret analizi ve kalıcı yerel ayarlar

- Yeni ret analizi modülü için izole, geçici SQLite veritabanında 10 test geçti. Sağlayıcı yanıtları taklit edildi; testler gerçek API isteği veya kullanıcının veritabanına erişim yapmadı. Yetki/tarih kapsamı, önbellek, konuşmanın değişmesi, bozuk yanıt ve konuşmacı ayrıştırma gibi sınırlar kontrol edildi.
- Django sistem kontrolü, TypeScript tip kontrolü ve frontend üretim derlemesi başarılı. Bu kayıt özellik geliştirilirken yapılan kontrolleri özetler; son CSS boşluk düzenlemesinden sonra test paketi yeniden çalıştırılmadı.
- OpenAI bağlantı kontrolü 30 Ekim 2026 06:29 UTC'de HTTP 200 ve tamamlanmış `OK` yanıtı verdi. Bu küçük istek transkript içermedi; sınıflandırma doğruluğunu doğrulamaz.
- Gerçek 25 transkript için uçtan uca sınıflandırma, insan etiketleriyle doğruluk karşılaştırması ve PostgreSQL üzerinde eşzamanlı analiz davranışı doğrulanmış değildir. SQLite testleri PostgreSQL satır kilitlerinin yerini tutmaz.
- Kullanıcı ekran görüntüleri yeni sayfa yerleşimini gösterir. Bu aşamada otomatik tarayıcı veya cihaz FPS testi yapılmadı. Sidebar ve başlık boşlukları görsel geri bildirime göre düzenlendi.
- Case kontrolünde zorunlu temsilci sıralaması ekranının eksik olduğu belirlendi. Bu açık nokta README'ye yazıldı; mevcut temsilci listesi performans sıralaması olarak sunulmaz.
