const FALLBACK_PREFIX = 'tmp-id';

const generateFromCryptoValues = (cryptoApi: Crypto) => {
  if (typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));

    // Variant and version bits per RFC4122
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));

    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join('')
    ].join('-');
  }

  return null;
};

/**
 * Gera um UUID compatível mesmo em ambientes sem suporte a crypto.randomUUID.
 */
export const generateRandomId = () => {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  const uuid = cryptoApi ? generateFromCryptoValues(cryptoApi) : null;

  if (uuid) {
    return uuid;
  }

  // Fallback simples para ambientes sem Web Crypto disponível
  return `${FALLBACK_PREFIX}-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
};


