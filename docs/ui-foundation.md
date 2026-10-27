# Arayüzün görsel temeli

Görsel kabuk; giriş, profil, kullanıcı yönetimi ve takım planlama ekranlarını taşır. Raporlama akışları sonraki aşamadır. Görünür arayüzde örnek KPI, slogan veya tanıtım kartları bulunmaz.

## Katmanlar

1. Tam ekran zemin ve ekranın tam merkezinde duran logo.
2. Logoya ışık kırılması ve bulanıklık uygulayan sürekli cam yüzey.
   Giriş kartının camı, oturum açıldığında navbar altındaki çalışma alanına genişler.
3. Ekranın üst kenarına bitişik, tam genişlikte ve 70 px yüksekliğinde sabit navbar.
4. Tema kontrolünün cam gövdesi ve kayan seçim merceği.
5. Normal HTML/SVG olarak kalan etkileşimli içerik.

Navbar ve arka plan aynı özgün `public/assets/logo.svg` dosyasını kullanır. Kaynak SVG değiştirilmez. `BrandLogo` bileşeni yalnızca şeffaf kenarları görünüm alanının dışında bırakır; boyutlandırma ve merkezleme görünür çizime göre yapılır. Navbarın altında ayrıca bir açıklama bulunmaz.

## Referanstan uyarlanan akış

ReportGuerilla'nın 460 px giriş kartı, 34 px iki satırlı başlığı, genişleyen cam geçişi, üst kampanya sekmeleri, soldaki işlem navigasyonu ve alttaki profil düzeni uyarlanmıştır. Referansın koyu antrasit paleti yerine mevcut Pozitif siyah/beyaz paleti korunur. Orb bulunmaz.

Takım planlama üç alandan oluşur: kayıt kütüphanesi, sürüklenebilir bağlantı haritası ve özellikler. Geri al/yinele, kopyala, bağlantı seçimi, arşivleme, pan/zoom ve açık kaydetme akışı vardır. Harita React Flow kullanır; özellikler paneli bağlantıları sürükleme gerektirmeden klavyeyle de kurar. Kaydedilmemiş veriyle sayfa değiştirmede onay gösterilir. Kaptan ve yönetici düzenleme araçlarını görmez; API de yazmayı reddeder.

Mobilde sidebar açılır menü olur; kütüphane ve özellikler haritanın üstüne/altına geçer. Kullanıcı/temsilci tabloları kendi alanlarında yatay kaydırılır. Diyaloglar yerel HTML `dialog` öğesiyle odağı içeride tutar. Oturum geçişinden sonra odak ana içeriğe taşınır.

## Tek ayar dosyası

**`frontend/src/config/visual.config.ts`**

Değerleri kaydedip sayfayı yenileyin. Geliştirme sunucusu açıkken değişiklikler genellikle otomatik yansır. Derlenmiş sürüm kullanılıyorsa `npm run build` tekrar çalıştırılır.

| Ayar                          | Varsayılan | Etkisi                                                       |
| ----------------------------- | ---------- | ------------------------------------------------------------ |
| `layout.navbarHeightPx`       | 70         | Üst kenara bitişik navbar yüksekliği                         |
| `glass.background.blurPx`     | 3.5        | Tam ekran camın bulanıklığı                                  |
| `glass.navigation.blurPx`     | 10         | Navbar camının ek bulanıklığı                                |
| `glass.control.blurPx`        | 4          | Tema düğmesi gövdesinin ek bulanıklığı                       |
| `glass.selection.blurPx`      | 2          | Kayan seçim merceğinin ek bulanıklığı                        |
| `glass.workspace.blurPx`      | 10.2       | Girişten çalışma alanına genişleyen camın bulanıklığı        |
| `glass.workspace.veilOpacity` | 0.22       | Yazıların arkasındaki logonun kontrastını azaltan tonlama    |
| `motion.authMorphMs`          | 1600       | Giriş/çıkışta camın geometrik geçiş süresi                   |
| `motion.contentFadeMs`        | 240        | Form ve çalışma alanı içerik geçişi                          |
| `theme.transitionMs`          | 1800       | Siyah/beyaz logo ve zemin geçiş süresi                       |
| `logo.maxWidthPx`             | 560        | Arka plan logosunun en büyük genişliği                       |
| `logo.viewportWidthRatio`     | 0.42       | Masaüstünde ekran genişliğine oranı                          |
| `logo.mobileWidthRatio`       | 0.62       | Dar ekranda ekran genişliğine oranı                          |
| `logo.centerX / centerY`      | 0.5 / 0.5  | Ekranın tam merkezi                                          |
| `logo.opacity`                | 1          | Tam opak siyah/beyaz logo; cam bulanıklığı ayrıca uygulanır  |
| `logo.glowRadiusPx`           | 10         | Logonun çevresindeki hafif ışık/gölgenin yayılımı            |
| `logo.glowStrength`           | 0.06       | Kenar parlamasının gücü; 0 kapatır                           |
| `perspective.tiltXRadians`    | 0.24       | Referansın yatay perspektif katsayısı; uçta yarısı uygulanır |
| `perspective.tiltYRadians`    | 0.18       | Referansın düşey perspektif katsayısı; uçta yarısı uygulanır |
| `perspective.parallaxFactor`  | 0.055      | Bakışın ters yönündeki kayma; uçta ekranın %2.75'i           |
| `perspective.cameraDistance`  | 1.8        | Referansın normalize kamera mesafesi                         |
| `perspective.followAt60Fps`   | 0.065      | 60 Hz için takip oranı; diğer hızlarda zamana uyarlanır      |
| `performance.maxFps`          | 60         | Yalnız WebGL arka planının azami çizim hızı                  |
| `wake.lifetimeMs`             | 1800       | Su izinin sönme süresi                                       |
| `wake.softnessPx`             | 22         | Dalga kenarlarının yumuşaklığı                               |
| `wake.refractionPx`           | 12         | Su izinin arka planı bükme miktarı                           |
| `wake.lightStrength`          | 0.045      | Su izinin aydınlık/gölge görünürlüğü                         |
| `performance.renderer`        | auto       | WebGL tercih edilir; `css` yedek görünümü zorlar             |

Blur değerleri CSS pikselidir. **0 net**, yüksek değer daha bulanık görünüm verir. Üst üste gelen katmanların bulanıklıkları birleşir. Örneğin yalnızca arka plandaki logoyu netleştirmek için `glass.background.blurPx` değerini azaltın. CSS yedek görünümü de aynı ayar dosyasını kullanır.

`perspective.enabled` ve `wake.enabled` efektleri ayrı ayrı kapatır. Logo yüksekliği de ekran yüksekliğinin %44'üyle sınırlandırılır; kısa ekranlarda taşmaz.

## Perspektif nasıl çalışıyor?

Hesap, ReportGuerilla'nın `app/js/liquid-backdrop.js` dosyasındaki ışın–düzlem kesişimi ve ters yönlü paralakstan uyarlanmıştır. Sağ tarafa bakınca uzaktaki logo sola kayar; küçük bir perspektif farkı oluşur. Logo etrafında dönen kamera ve önceki silindir hesabı kaldırılmıştır. Orijinal referansın renkleri ve büyük logo boyutu alınmaz; Pozitif logosunun boyutu, merkez konumu ve siyah/beyaz rengi korunur.

`logoProjection.ts` referans denklemini kare başına bir kez hesaplanan 3×3 dönüşüm matrisine çevirir. Shader her piksel için silindir, karekök ve açı hesabını tekrarlamaz. Takip hareketi referanstaki 0.065 yumuşaklıkla, ekran yenileme hızından bağımsız ilerler. Fare pencereden çıkınca bakış merkeze döner. Kamera veya jiroskop izni kullanılmaz.

WebGL 2 açılamazsa `createCssPerspective.ts` aynı matrisin tersini CSS `matrix3d` olarak uygular. Yedek görünümde de kayma ve perspektif yönü aynıdır. Su izi ve shader kenar kırılmaları yalnız WebGL'de bulunur. CSS görünümünde arka plan bulanıklığı doğrudan logo üzerinde uygulanarak fazladan tam ekran backdrop filtresi kaldırılır. `performance.renderer: 'css'` bu yolu test etmek içindir; normal tercih `auto` değeridir.

## Su izi ve cam

`pointerWake.ts` fare yolunu eşit aralıklı noktalara örnekler. Hızlı hareketlerde ara noktalar eklenir; tıklayıp sürüklerken iz hafif güçlenir. Shader bu noktaları genişleyen, zamanla sönümlenen yumuşak dalgalara dönüştürür. Dalganın yüzey eğimi hem arka planın kırılmasını hem aydınlık/gölge yansımasını etkiler. Animasyon sürekli dönmez; yalnızca hareketten doğar.

`GlassSurface` DOM sınırlarını ortak WebGL çizicisine bildirir. Yuvarlatılmış yüzey normalleri, 1.46 kırılma indisi, kenar yansımaları ve mipmap destekli bulanıklık tek sahnede birleştirilir.

Bu, tarayıcı için bir optik yaklaşımdır; Apple'ın özel Liquid Glass motoru değildir. **Çizici logoyu ve kendi zeminini kırar; HTML tablolarını otomatik olarak dokuya çevirmez.** Veri panelleri normal HTML ve yarı saydam CSS yüzeyleridir. Giriş/çalışma camının tonlaması, arka plan logosunun form metnini bastırmasını önler. En fazla sekiz cam yüzeyi ve 32 aktif su izi örneği kullanılır.

## Tema, erişilebilirlik ve performans

- Tema rengi 1.8 saniyede kesintisiz değişir. Geçiş sırasında yeniden tıklanırsa o anki renkten ters yöne devam eder.
- Navbar logosunun siyah/beyaz değişimi de animasyonludur.
- Arka plan logosu açık temada siyah, koyu temada beyazdır; opaklıkla soldurulmaz. Kenardaki hafif parlama/gölge ve cam bulanıklığı bu rengin üzerine uygulanır.
- Tema tercihi `localStorage` içinde `pozitifai.theme` anahtarında tutulur; ilk ziyarette sistem teması kullanılır.
- Metin ve düğmeler normal HTML olarak kalır. Tema kontrolü klavye ile kullanılabilir ve durumunu ekran okuyucuya bildirir.
- `prefers-reduced-motion` etkinse kamera/su izi çalışmaz ve tema geçişi anında tamamlanır.
- Dokunmatik kaydırma hareketi efekt üretmez.
- GPU çizimi en fazla 1.2 milyon piksel ve 1.5 cihaz piksel oranıyla sınırlıdır.
- Hareket, renk geçişi ve kalan su izleri bittikten sonra çizim durur. Görünmeyen sekmede yeni kare üretilmez.
- WebGL çalışmazsa CSS cam ve aynı perspektif kullanılır; su izi ve optik kenar kırılmaları WebGL gerektirir. Bağlam geri gelirse CSS hareket dinleyicileri kaldırılır ve WebGL tekrar devreye girer.

## Optimizasyonun görsel maliyeti

Tema tek `themeTransition.ts` ilerleme değerinden yönetilir. CSS paleti ve WebGL aynı örneği okur; yüzeylerde ayrı renk geçişleri çalışmaz. Hızlı ters geçiş mevcut renkten devam eder. Sidebar ve içerik aynı camın üzerinde durur. Kampanyalar `surfaceGeometry.ts` ile bu camın üst kenarına eklenen çıkıntılardır; ayrı kutular değildir. Navbar gridinin ilk sütunu sidebar genişliğidir; kampanya şeridi 12 px içeriden başlar.

Çalışma alanı tek bir kırpılmış CSS backdrop katmanıdır; aynı yüzey WebGL içinde ikinci kez hesaplanmaz. Navbar ve kontrol mercekleri WebGL optiğini korur. Tema sırasında yalnız kayan seçim merceği ölçülür; diğer yüzeylerin sınırları önbellekte kalır. Cam şekli boyut/kampanya/kaydırma değişince ölçülür, renk geçişinde ölçülmez.

Dekoratif WebGL çizim bütçesi 2.4 milyondan 1.2 milyon piksele indirildi. Metin ve HTML kontrolleri doğal çözünürlüktedir. Büyük ekranlarda arka plan biraz daha yumuşak görünebilir; `performance.maxRenderPixels` yükseltilerek önceki bütçeye dönülebilir. Dokuz örnekli logo blur, perspektif ve su izi korunur. Çalışma camının `veilOpacity` değeri 0.22'dir; alttaki paleti daha fazla gösterir. 60 FPS üst sınırı yalnız dekoratif canvas için geçerlidir.

Bu optimizasyonlar kaynak kodu ve tarayıcıda doğrulanmıştır; Opera GX üzerinde önce/sonra GPU süresi ölçülmediği için yüzdelik hızlanma iddiası yoktur. Genel yaklaşım için [MDN WebGL performans rehberi](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).

Bu sınırlar sabit FPS garantisi vermez. Yerel LLM ile birlikte kullanım hedef bilgisayarda ayrıca ölçülmelidir.

## Giriş ve üst camın katman sırası

ReportGuerilla `auth-shell.js` ve `surface-geometry.js` akışı esas alınır. Girişte navbar ve arka üst cam gizlidir; girişe ait logo ve tema kontrolü ayrı, zeminsiz bir başlıkta kalır. Giriş içeriği söndükten sonra ön cam büyür. 70 px arka üst cam ve üzerine bağlı kontroller aynı geometrik ilerleme değeriyle aşağı gelir. Kampanya metinleri cam yerleştikten sonra görünür.

Katman sırası: logo sahnesi → arka üst cam (15) → çıkıntılı ön cam (20) → çalışma içeriği (22) → giriş içeriği (24) → zeminsiz gezinme kontrolleri (30). `PortalHeader` cam üretmez; yalnız içerik taşır. Böylece çıkıntıların üzerinde bütün genişliği kaplayan bir filtre, arka plan ya da gölge bulunmaz. Arka üst camın blur ayarı `glass.navigation.blurPx` değeridir.
