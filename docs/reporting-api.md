# Rapor hesaplama servisi

`GET /api/reports/kpis` oturum açmış kullanıcı için filtrelenmiş KPI özeti ve isteğe bağlı kırılım döndürür. Dashboard bu servisi kullanır; Excel de aynı `portal.reporting.calculate_report` servisini kullanabilir. KPI hesapları tarayıcıda tekrarlanmaz.

## Filtre ve gruplama sözleşmesi

| Parametre    | Değer                                                                     | Davranış                                                      |
| ------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `agentId`    | Temsilci kimliği                                                          | Tekrarlanabilir; aynı parametrenin değerleri OR ile birleşir. |
| `teamId`     | Takım kimliği                                                             | Güncel temsilci üyeliğine uygulanır; tekrarlanabilir.         |
| `campaignId` | Kampanya kimliği                                                          | Tekrarlanabilir.                                              |
| `dateFrom`   | `YYYY-MM-DD`                                                              | Yerel başlangıç günü dahil; tek başına kullanılabilir.        |
| `dateTo`     | `YYYY-MM-DD`                                                              | Yerel bitiş gününün tamamı dahil; tek başına kullanılabilir.  |
| `groupBy`    | `agent,team,campaign,day,hour` içinden virgülle ayrılmış, tekrarsız seçim | Yoksa yalnızca genel özet; birden fazlaysa birleşik gruplama. |
| `limit`      | 1–1000; varsayılan 200                                                    | Yalnızca kırılım satırlarının sayfa boyutu.                   |
| `offset`     | 0–100000; varsayılan 0                                                    | Kırılım sayfasının başlangıcı.                                |

Farklı filtreler AND ile birleşir. Her kimlik alanı en fazla 100 değer alır. Kimlikler ad değil, veritabanındaki 1–12 karakterlik iş kimlikleridir. Geçerli fakat bulunmayan veya yetki dışında kalan kimlikler boş sonuç üretir; başka takımdaki varlıkların mevcut olduğu açıklanmaz. Parametreyi boş göndermek veya bilinmeyen parametre kullanmak hatadır; filtreyi kaldırmak için parametreyi göndermeyin.

Örnekler (oturum çerezi gerekir):

```text
/api/reports/kpis
/api/reports/kpis?groupBy=agent
/api/reports/kpis?teamId=A&campaignId=KAMPANYA1&dateFrom=2026-10-01&dateTo=2026-10-14&groupBy=agent,day
/api/reports/kpis?teamId=A&teamId=B&groupBy=team,campaign
/api/reports/kpis?dateFrom=2026-10-01&dateTo=2026-10-14&groupBy=hour
```

Örnek kimlikler yer tutucudur. `hour` 0–23 yerel saatidir; seçilen günlerin aynı saatleri birleştirilir. Gün-saat matrisi için `groupBy=day,hour` kullanılır. Saat/gün boşluklarına otomatik sıfır satır üretilmez; görünüm bunu daha sonra belirleyebilir. Aynı adlı kişiler kimlikleri farklı olduğu sürece ayrı gruplardır.

## Yanıt

- `schemaVersion`, `formulaVersion`: Yanıt ve formül sürümleri.
- `generatedAt`, `timezone`, `teamBasis`: Hesaplama anı, `Europe/Istanbul` ve `current` takım ataması.
- `scope`: Sunucunun uyguladığı takım yetkisi. İstemci kapsamı genişletemez.
- `filters`: Uygulanan kullanıcı filtreleri.
- `summary`: Filtrelere uyan bütün çağrıların KPI'ları.
- `dateCoverage.undatedCallsExcluded`: Yetki ve kimlik filtrelerine uyan, tarih koşulu nedeniyle dışarıda kalan tarihsiz çağrılar. Bu sayı seçilen döneme ait oldukları iddiası değildir. Tarih koşulu yoksa sıfırdır.
- `breakdown`: Gruplama yoksa `null`; varsa `dimensions`, `totals`, `excludedCalls`, `rows`, `pagination` içerir.

Kırılım satırı `dimensions` ve `metrics` taşır. Varlık boyutları `{id, name}`, gün `YYYY-MM-DD`, saat tamsayıdır. Sıralama seçilen boyutların kimlik/tarih/saat değerlerine göre sabittir. `pagination` içindeki `totalGroups` bütün grupların sayısıdır; `nextOffset` son sayfada `null` olur. `summary` ve `breakdown.totals` sayfalama nedeniyle daralmaz.

Eksik boyut anahtarı olan çağrı ilgili kırılıma alınmaz: temsilci için bilinmeyen temsilci, takım için güncel üyeliği bulunmayan temsilci, gün/saat için tarihsiz çağrı. `breakdown.excludedCalls` bu sebeplerin birleşiminden dışarıda kalan benzersiz çağrı sayısıdır. Birden çok eksik alan iki kez sayılmaz. Kırılımın bütün sayfalarındaki çağrı toplamı `breakdown.totals.totalCalls` değerini verir; buna `excludedCalls` eklenince genel toplam bulunur. Bu eşitlik kalite ortalamaları veya yüzdeleri toplayarak kurulmaz.

## KPI alanları

| Alan                                                               | Hesap                                                                      |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `totalCalls`                                                       | Bir kayıt = bir benzersiz kabul edilmiş çağrı.                             |
| `salesCalls`, `rejectedCalls`, `callbackCalls`, `unreachableCalls` | İlgili bilinen sonuç sayıları.                                             |
| `unknownResultCalls`                                               | Boş veya tanımlı dört sonuç dışında kalan sonuçlar.                        |
| `reachedCalls`                                                     | Satış + ret + geri ara.                                                    |
| `reachRate`                                                        | Ulaşılan / toplam × 100.                                                   |
| `conversionRate`                                                   | Satış / ulaşılan × 100.                                                    |
| `averageTalkSeconds`                                               | Ulaşılan ve geçerli süreli çağrıların süre toplamı / adedi.                |
| `averageQualityScore`                                              | Kullanılabilir kalite toplamı / değerlendirme adedi; ulaşma koşulu yoktur. |

Payda sıfırsa oran/ortalama `null`; payda pozitif ve pay sıfırsa sayısal `0` döner. `rateUnit=percent`, oranların 0–100 ölçeğinde olduğunu belirtir. Görünüm için iki basamak gibi bir yuvarlama uygulanmaz; türetilen değerler JSON sayısıdır.

`qualityComponents`, `greeting`, `needAnalysis` ve `closure` nesnelerini içerir. Her biri `averageScore` (0–100 veya null), `scoreCount` ve tam iki ondalıklı `scoreSum` string alanlarına sahiptir. Eksik alt puanlar o bileşenin paydasına katılmaz; sıfır puan geçerlidir. Bu alanlar özet ve bütün kırılımlarda aynı kuralla hesaplanır. Dashboard toplam ve alt kalite puanlarını 10'a bölerek `/10` gösterir; API ölçeği değişmez.

Her metrik nesnesindeki `basis`, yeniden ağırlıklı hesaplama için `talkSecondsSum`, `talkDurationCount`, `qualityScoreSum`, `qualityScoreCount` içerir. Kalite toplamı tam iki ondalıklı bir **string** döner; veritabanında puanlar önce tamsayı yüzde birimlerine çevrilerek toplanır. Böylece SQLite'ın kayan noktalı SUM davranışı toplamı bozmaz. Ortalamalar ve yüzdeler üst gruplarda bu temel toplamlarla yeniden hesaplanır; alt grupların ortalamaları ortalanmaz.

`coverage` alanları: `undatedCalls`, `unknownAgentCalls`, `unassignedTeamCalls`, `missingOrInvalidDurationCalls`, `reachedWithoutDurationCalls`, `withoutUsableQualityCalls`. Bu adetler örtüşebilir; toplanarak sorunlu çağrı sayısı üretilmemelidir. Sıfır saniye ve sıfır kalite geçerli değerlerdir. Ulaşılamayan çağrı süresi konuşma ortalamasına girmez; geçerli kalite puanı kalite ortalamasına girebilir.

## Yetki, doğruluk ve çalışma sınırları

- Kullanıcı aktifliği ve oturum yetki sürümü servis içinde yeniden kontrol edilir. Admin/yönetici tüm takımları, kaptan yalnızca güncel takımını görebilir. Kaptanın bilinmeyen temsilcili çağrılara erişimi yoktur.
- Takım geçmişi çağrının yapıldığı güne bağlanmaz. Üyelik aynı hesaplama anında okunur; atama geçmişi doğrudan çağrılara çoklayan bir JOIN ile bağlanmaz. Kalite OneToOne ilişkisidir; değerlendirme bulunmaması çağrıyı düşürmez.
- Tarih aralığı `[başlangıç günü, bitişin ertesi günü)` olarak uygulanır. Veritabanındaki yerel timestamp gün/saat kırılımında ikinci kez saat dilimi dönüşümünden geçirilmez.
- Bağımsız PostgreSQL çağrısı `REPEATABLE READ, READ ONLY` transaction ile özet ve kırılımı aynı veri görüntüsünden okur. SQLite'ta tek transaction kullanılır. Servisi mevcut transaction içinde çağıran dışa aktarım kodu kendi snapshot/izolasyon politikasından sorumludur.
- API hesaplamadan sonra filtre/gruplama bilgisini `report.calculated` işlem kaydına yazar; ham konuşma veya rapor satırlarını loga kopyalamaz. Çağrı, kalite, kaynak dosya veya kullanıcı kaydı değiştirilmez.
- `RPT001`: Parametre/kimlik/gruplama/sayfalama hatası. `RPT002`: Tarih biçimi/aralığı hatası. `RPT003`: Veritabanı işlemi başarısız; bağlantıyı kontrol ederek yeniden deneyin. Giriş ve yetki sorunları mevcut `AUTH001`/`AUTH003` kodlarını kullanır.
- Excel dosyası, LLM sınıflandırması ve sonuç kategorisine göre ek filtre bu servisten ayrı geliştirilir. Kalite alt puanlarının eklenmesi yeni migration gerektirmez.

## Dashboard

`frontend/src/features/dashboard` özel SVG göstergelerini, filtreleri ve animasyon saatini içerir. Kampanya üst sekmelerden, takım/temsilci/tarih aralığı sayfa içinden seçilir. Tek gün için iki tarih aynı seçilir. Her değişiklikte `groupBy=hour&limit=24` ile özet ve saatlik veriler aynı sunucu görüntüsünden alınır. Hızlı filtre değişiklikleri 220 ms geciktirilir; eski istek iptal edilir ve eski sonuç yeni filtreye aitmiş gibi gösterilmez. Takım kaptanının seçimi kendi takımıyla sınırlıdır; esas yetki kontrolü sunucudadır.

09–18 saatleri boş olsa da gösterilir. Bu aralık dışında gerçek çağrı varsa grafik aralığı genişler; saat bilgisi olmayan çağrılar grafiğe alınmaz ve adedi açıklanır. Saat satırları fare, klavye veya dokunmayla seçilebilir. Kalite ve süre için gözlem yoksa `—` gösterilir.

Animasyonlar `visual.config.ts` içindeki `dashboard.springFrequency` ile ayarlanır. Tek `requestAnimationFrame` döngüsü SVG ve metinleri günceller; React sayfasını her karede yeniden çizmez. Değerler yerleşince döngü durur; azaltılmış hareket tercihi ve arka plandaki sekme animasyonu son değere geçirir. Widget'lar mevcut ortak cam yüzeyini kullanır; ilave WebGL veya ayrı blur katmanları oluşturmaz.

Çalıştırılan kontroller ve çalıştırılmayan senaryolar [doğrulama kaydında](verification.md) ayrıdır.
