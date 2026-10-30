# Formüllü Excel raporu

Dashboard'daki **Excel indir**, kullanıcının yetkili olduğu tüm çağrıları `GET /api/reports/excel` üzerinden indirir. O anda seçilen takım, temsilci, kampanya ve başlangıç/bitiş tarihi **Summary'nin değiştirilebilir varsayılan seçimleri** olur; RawData'yı daraltmaz. Sunucu, KPI sorgusuyla aynı güncel kadroyu ve yetki kapsamını kullanır. Takım kaptanının dosyasına başka takımların verileri, gizli sütunlar dahil, yazılmaz. İndirme işlemi `report.exported` adıyla varsayılan filtreler, tüm yetkili veri kapsamı ve satır sayısıyla işlem geçmişine kaydedilir.

Rapor bir indirme anı görüntüsüdür; veritabanına bağlantı veya parola içermez. Excel'deki “Tüm” seçeneğine dönmek, başka bir temsilci/kampanya seçmek veya tarihi değiştirmek için yeniden indirme gerekmez. Yetki sınırı değişmez: kaptanın dosyasındaki “Tüm”, yalnızca kendi takımının verisidir. Tek indirme en fazla 50.000 çağrı içerir; aşan veri sessizce kesilmez. Dashboard filtresini daraltmak bu sınırı azaltmaz; kapsamın tamamı dışa aktarılır.

## Şablon ve RawData

Çalışan uygulamanın şablonu `backend/portal/reporting/templates/report.xlsx` içindedir. Yol proje konumundan çözülür; sunucuda Excel kurulumu veya ek bir tablo yazma paketi gerekmez. Kullanıcının `Report/schematic.xlsx` tasarımının Summary yerleşimi, renkleri, yazı tipleri, kenarlıkları ve ölçüleri korunmuştur.

Her indirmede RawData'nın A1:L1 başlıkları ve A2'den itibaren çağrı başına tek satır doldurulur:

`Call ID, Agent, Agent Team, Call Start, Duration, Result, Campaign, Rater, Total Score, Greeting Score, Need Analysis Score, Closure Score`

Tarihler Excel tarih değeri, süreler saniye, puanlar sayısal değer olarak yazılır. Eksik değer boş kalır. Sonuç adları Satış, Ret, Geri ara, Ulaşılamadı ve Belirsiz'dir. Kaynak metinler formüle dönüşmeyecek biçimde açıkça metin olarak kaydedilir.

RawData'daki `ReportData` Excel tablosu, her indirmede gerçek satır sayısına göre genişler. M:Y gizli yardımcı sütunları gün, saat, ulaşılan çağrı, geçerli süre, filtre eşleşmesi ve benzersiz seçim listelerini hesaplar; AA1:AD1 tarih sınırlarını ve girişin geçerliliğini çözer. Yardımcı hesaplar şeffaf biçimde incelenebilmesi için sütunlar açılarak görülebilir. Görünen 12 sütun değiştirilmez. Summary'de hazır sonuç yazılmaz; yalnızca dört filtre hücresi doldurulur, KPI'lar mevcut formüllerle hesaplanır.

## Excel içindeki filtreler

| Hücre | Seçim        | İlk seçenek                            |
| ----- | ------------ | -------------------------------------- |
| J4    | Takım        | Tüm Takımlar                           |
| J7    | Temsilci     | Tüm Temsilciler                        |
| O7    | Kampanya     | Kampanyalar — tümü                     |
| O4    | Tarih/aralık | Seçili Tarihe Kadar — tarih sınırı yok |

Her alan tek seçimlidir; farklı alanlar birlikte uygulanır. Listeler RawData'dan formülle üretilir, veri büyüdükçe yenilenir. Mevcut tarih kutusunun konumu ve görünümü korunur:

- Listeden seçilen veya `15.10.2026` biçiminde girilen tek tarih, **o günün sonuna kadar** bütün kayıtları kapsar.
- `01.10.2026–15.10.2026` iki tarih arasını, başlangıç ve bitiş günü dahil, kapsar. Dashboard'da iki sınır seçilmişse bu biçimde gelir. Boşluklu normal tire de kullanılabilir: `01.10.2026 - 15.10.2026`.
- `01.10.2026+` o günden itibaren tüm tarihleri kapsar; dashboard'da yalnız başlangıç seçilince bu biçimde gelir.
- “Seçili Tarihe Kadar” seçeneğine dönmek **iki sınırı da kaldırır**. Gizli, kalıcı bir başlangıç filtresi bırakılmaz. Tarih kutusuna yeni bir aralık elle yazılabilir; geçersiz/aralığı ters bir tarih KPI'larda hata gösterir, doğru sıfır sonuç gibi sunulmaz.

Herhangi bir yıl/ay sabitlenmez. Tarihi eksik çağrılar tarih sınırı yokken dahil edilir; tarih seçilince dışarıda kalır. Saatlik tablo şablondaki 09–18 saatlerini korur; diğer saatlerdeki çağrılar genel KPI toplamlarına yine dahildir.

Temsilci ve takım seçimleri kullanıcı isteği doğrultusunda görünen adlarla yapılır. Aynı ada sahip iki ayrı temsilci varsa Excel seçiminde birlikte hesaplanırlar; portalın kimlik bazlı filtreleri farklı kayıtları ayırmaya devam eder.

## Hesaplama kuralları

- Toplam çağrı: filtrelerle eşleşen Call ID sayısı. Ulaşılan: Satış, Ret ve Geri ara. Ulaşılamayan: Ulaşılamadı. Belirsiz sonuçlar toplamda kalır, ulaşılan kabul edilmez.
- Ulaşma oranı: ulaşılan / toplam. Dönüşüm: satış / ulaşılan. Payda sıfırsa sonuç boş bırakılır.
- Ortalama süre: ulaşılan çağrıların geçerli, sayısal ve negatif olmayan sürelerinin ortalaması. Eksik süre dışlanır; gerçek sıfır süre dahildir. Ekranda saat:dakika:saniye gösterilir.
- Kalite: her puan sütunu kendi geçerli 0–100 değerleriyle ortalanır, /10 gösterilir. Eksik puan sıfır yapılmaz; sıfır puan dahildir. Alt puanların paydaları bağımsızdır.
- Saatlik yoğunluk: Call Start'ın saati üzerinden filtreli çağrı ve ulaşılan sayıları, ardından ulaşılan / çağrı oranı.

Şablon Excel 2016'nın desteklediği `COUNTIFS`, `SUMIFS`, `AVERAGEIFS`, `INDEX`, `MATCH`, `SMALL` ve temel tarih/metin formüllerini kullanır. Dinamik dizi, `FILTER`, `UNIQUE`, `XLOOKUP`, makro veya dış bağlantı gerekmez. Tarih listesi Excel'in dilinden etkilenmemesi için gün/ay/yılı sayısal parçalarla oluşturur. Excel'in yerel tarih sistemi nedeniyle 1900 öncesi tarihler desteklenmez; böyle bir dışa aktarma açıklamalı hata verir.

## Dosyayı elle yenilemek

Portal her indirmede tabloyu ve formülleri kendisi hazırlar. Elle veri değiştirmek isterseniz yalnızca **A:L** alanındaki eski verileri temizleyip aynı başlık sırasıyla yeni veriyi yapıştırın; gizli yardımcı sütunları silmeyin. Eski satırları bırakıp daha kısa veri yapıştırmak, eski kayıtları hesapta tutar. Yeni satırlar `ReportData` tablosunun içinde olmalıdır; Excel'in otomatik tablo genişletmesi kapalıysa **Tablo Tasarımı → Tabloyu Yeniden Boyutlandır** ile tabloyu yeni son satıra kadar genişletin. Yeni çağrı tarihleri metin değil Excel tarih değeri olmalıdır. Eski filtre seçimi yeni veride yoksa ilk “Tüm” seçeneklerine dönün.

Excel'de **Formüller → Hesaplama Seçenekleri → Otomatik** açık olmalıdır. Dosya otomatik yeniden hesaplama isteğiyle üretilir; formül motoru çalıştırmayan önizleme araçları boş veya eski hesap gösterebilir. Değişiklikleri ve dosyayı kendi Excel sürümünüzde açmayı kapsayan doğrulama sınırları [doğrulama kaydında](verification.md) belirtilir.
