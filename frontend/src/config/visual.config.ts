/** Görsel ayarlar. Değeri değiştirip kaydet; geliştirme sunucusu görünümü yeniler. */
export const visualConfig = {
  layout: { navbarHeightPx: 70, navbarLogoWidthPx: 76 },
  theme: {
    // Arka plan ve logonun siyah ↔ beyaz geçiş süresi (milisaniye).
    transitionMs: 1800,
  },
  motion: { authMorphMs: 1600, contentFadeMs: 240 },
  // Yükleme kutuları: açılma/kapanma, metin geçişi ve kenar ışığının tur süresi.
  imports: { morphMs: 720, contentFadeMs: 160, borderTravelMs: 2800, cardRadiusPx: 16, gapPx: 20 },
  logo: {
    maxWidthPx: 560,
    viewportWidthRatio: 0.42,
    mobileWidthRatio: 0.62,
    maxViewportHeightRatio: 0.44,
    // 0.5 / 0.5, ekranın tam merkezidir.
    centerX: 0.5,
    centerY: 0.5,
    opacity: 1,
    // Logonun rengini soldurmadan kenarına çok hafif bir ışık/gölge ekler.
    glowRadiusPx: 10,
    glowStrength: 0.06,
  },
  glass: {
    // Blur değerleri CSS pikselidir; 0 net, yükselen değer daha bulanık görünüm verir.
    background: { blurPx: 3.5, refractionPx: 16 },
    navigation: { radiusPx: 0, blurPx: 10, refractionPx: 16, tint: 0.055 },
    control: { radiusPx: 24, blurPx: 4, refractionPx: 12, tint: 0.045 },
    selection: { radiusPx: 19, blurPx: 2, refractionPx: 9, tint: 0.1 },
    workspace: {
      radiusPx: 0,
      blurPx: 10.2,
      refractionPx: 12,
      tint: 0.12,
      veilOpacity: 0.22,
      loginVeilOpacity: 0.72,
    },
  },
  perspective: {
    enabled: true,
    // ReportGuerilla liquid-backdrop.js: küçük perspektif + ters yönde arka plan kayması.
    tiltXRadians: 0.24,
    tiltYRadians: 0.18,
    parallaxFactor: 0.055,
    cameraDistance: 1.8,
    followAt60Fps: 0.065,
  },
  wake: {
    enabled: true,
    lifetimeMs: 1800,
    sampleSpacingPx: 18,
    spreadPxPerSecond: 38,
    softnessPx: 4,
    refractionPx: 4,
    lightStrength: 0.045,
  },
  performance: {
    // auto: WebGL, kullanılamıyorsa CSS. css: yedek görünümü doğrudan kullan.
    renderer: 'auto' as 'auto' | 'css',
    maxDevicePixelRatio: 1.5,
    maxRenderPixels: 1_200_000,
    // Yalnız dekoratif WebGL sahnesi; HTML/arayüz animasyonları bu sınıra tabi değil.
    maxFps: 60,
    powerPreference: 'high-performance' as WebGLPowerPreference,
  },
} as const;

export type GlassMaterial = 'navigation' | 'control' | 'selection' | 'workspace';
