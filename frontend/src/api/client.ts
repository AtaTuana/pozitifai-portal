let csrf = '';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Cookies remain HttpOnly. Only the masked CSRF token is held in JavaScript memory. */
export async function api<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
  const multipart = payload instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        ...(multipart ? {} : { 'Content-Type': 'application/json' }),
        ...(method !== 'GET' ? { 'X-CSRFToken': csrf } : {}),
      },
      ...(payload === undefined ? {} : { body: multipart ? payload : JSON.stringify(payload) }),
      signal: AbortSignal.timeout(multipart ? 120_000 : 15_000),
    });
  } catch {
    throw new ApiError(
      'NET001',
      multipart
        ? 'Yükleme yanıtı alınamadı. Sunucu işlemi tamamlamış olabilir; yükleme geçmişini yenile. Aynı dosyayla tekrar denemek kayıtları çoğaltmaz.'
        : 'Sunucuya ulaşılamadı. Portalın başlatma penceresini kontrol et.',
      0,
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path !== '/login')
      window.dispatchEvent(new Event('portal:session-expired'));
    throw new ApiError(
      data?.error?.code || 'NET002',
      data?.error?.message || 'İşlem tamamlanamadı. Yeniden dene.',
      response.status,
    );
  }
  if (!data) throw new ApiError('NET002', 'Sunucudan geçerli yanıt alınamadı.', response.status);
  if (typeof data.csrf === 'string') csrf = data.csrf;
  return data as T;
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? `${error.code} · ${error.message}`
    : 'İşlem tamamlanamadı. Yeniden dene.';
}
