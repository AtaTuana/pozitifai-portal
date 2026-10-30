# Reddedilme nedenleri

Sidebar’dan **Reddedilme nedenleri** açılır. Navbar kampanyayı, takvim tarih kapsamını seçer. **Tüm zamanlar** tarihi bilinmeyen çağrıları da kapsar; tarih aralığı yalnızca başlangıç tarihi o aralıkta olan çağrıları kapsar. Gün sınırları Türkiye saatidir ve iki uç gün dahildir.

**Analiz Başlat**, yalnızca kapsam içindeki `Ret` sonuçlu ve transkripti yüklenmiş konuşmaları gönderir. Tarih değiştirmek veya sayfayı açmak API isteği başlatmaz. Anahtar `.local/runtime.json` üzerinden başlatıcıya yüklenir; tarayıcıya verilmez. Kurulum için [yerel ayarlar](local-settings.md).

## Yetki ve kayıt

- Admin ve yönetici analiz başlatır. Takım kaptanı yalnızca kendi takımının kayıtlı analizlerini ve konuşmalarını görüntüler.
- Her yanıt çağrı kimliği, kategori adları, en fazla iki farklı etiket ve JSON şeması açısından doğrulanır. Yanlış, yarım veya reddedilmiş yanıt başarı sayılmaz.
- Transkript, prompt sürümü ve model aynıysa tamamlanmış sonuç kullanılır. Transkript değişirse eski analiz güncel kabul edilmez.
- Prompt, girdi özeti, çıktı, token sayıları, süre ve işlemi başlatan kişi mevcut analiz tablolarına kaydedilir. İşlem geçmişine çağrı/analiz kimliği ve güvenli metaveri yazılır; API anahtarı yazılmaz.
- Aynı konuşmanın eşzamanlı analizi veritabanı kilidiyle engellenir. Ağ isteği sırasında veritabanı işlemi açık tutulmaz. Kullanıcı başına en fazla üç istek çalışır; otomatik ücretli tekrar yoktur.
- Sayfadan çıkmak yeni istekleri durdurur; sunucuda başlamış istek tamamlanıp kaydedilebilir. Yeniden açıldığında tamamlanan sonuçlar görünür.

## Kategoriler ve prompt

Dokuz kategori proje sahibi tarafından görüşmeler okunarak belirlendi: Güven Eksikliği, İlgilenmiyor, Düşünceli, Müsait Değil, Fiyat, Rakip Firma, Satış Kanalı, Gizlilik, Dijital Platform.

Proje sahibinin sağladığı [tam prompt](../backend/portal/rejection_analysis/prompts/rejection-v1.txt) değiştirilmeden kullanılır. En güçlü neden ilk sırada olmak üzere en fazla iki kategori döner. Yeterli dayanak yoksa boş liste döner; arayüz bunu **Belirlenemeyen** olarak gösterir. Bu, bekleyen veya başarısız analizden ayrıdır. Bir konuşma iki kategoriye girebildiği için çubuk toplamı analiz edilen konuşma sayısını aşabilir.

Prompt metni değiştirildiğinde `taxonomy.py` içindeki `PROMPT_VERSION` da artırılmalıdır. Aynı sürümün farklı içerikle sessizce üzerine yazılması engellenir. Varsayılan model `gpt-6-luna`; `OPENAI_MODEL` ile değiştirilebilir. Model Responses API, `reasoning.effort=none` ve Structured Outputs desteklemelidir. Sağlayıcı uygulaması [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) biçimini kullanır.

## Görsel akış

Takvim → gerçek analiz sırasında orb → başarılı yanıtlardan sonra spiral birleşme ve yeşil onay → kategori dağılımı → kategoriye ait çağrılar → temsilci/müşteri konuşması. Hazır sonuçları görüntülemek ücretli istek veya yapay bir başarı animasyonu başlatmaz. Hata halinde tamamlanan analizler korunur ve eksik olanlar yeniden denenebilir.

Takvim ve Fibonacci küresi/spiral hesabı proje sahibinin ReportGuerilla örneğinden uyarlanmıştır. Orb 900 parçacık ve 30 FPS sınırı kullanır; görünmeyen sekmede durur ve azaltılmış hareket tercihine uyar. Konuşma balonları kaynak metindeki konuşmacı etiketlerinden ayrıştırılır; metne isim, zaman veya mesaj eklenmez.

## HTTP uçları

- `GET /api/rejections?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&campaignId=...`: kapsam ve kayıtlı sonuçlar. Parametreler isteğe bağlıdır.
- `POST /api/rejections/analyze`: JSON içinde `callId` ve aynı isteğe bağlı filtreler; tek konuşmayı analiz eder veya kayıtlı sonucunu döndürür. CSRF ve oturum zorunludur.
- `GET /api/rejections/{callId}`: aynı filtrelerle, rol kapsamında konuşma ayrıntısı.

Bir seçim en fazla 1.000 transkript içerir; daha fazla kayıt için tarih aralığı daraltılır. İstek başına sağlayıcı zaman aşımı 45 saniyedir. Çalışma süresi sağlayıcı, ağ ve metin uzunluğuna bağlıdır; iki dakikanın altında bitiş garantisi verilmez.
