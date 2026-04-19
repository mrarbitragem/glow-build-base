/**
 * Extrai o ID do ficheiro a partir de ligações de partilha do Google Drive.
 * URLs do tipo `/file/d/ID/view` não funcionam em `<img src>`; é preciso thumbnail ou `uc`.
 */
export function extractGoogleDriveFileId(raw: string): string | null {
  let s = (raw || '').trim();
  if (!s) return null;
  if (s.startsWith('//')) s = `https:${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.hostname.toLowerCase() !== 'drive.google.com') return null;

  const fromPath = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$|\?)/);
  if (fromPath?.[1]) return fromPath[1];

  const id = u.searchParams.get('id');
  if (id && /^[a-zA-Z0-9_-]+$/.test(id) && id.length >= 10) return id;

  return null;
}

/** URL utilizável em `<img>` para imagens públicas no Drive (partilha: qualquer pessoa com a ligação). */
export function googleDriveFileUrlToImageSrc(url: string): string {
  const id = extractGoogleDriveFileId(url);
  if (!id) return url;
  // `thumbnail` devolve bytes de imagem; `export=view` por vezes devolve HTML em contas restritas.
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1600`;
}

/**
 * Valor vindo do MySQL/n8n para usar em `<img src>`: URL absoluta, relativa, data URL ou base64 cru.
 */
export function normalizeClubFlagSrc(raw: string): string {
  let s = (raw || '').trim();
  if (!s) return '';

  s = s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
  if (!s) return '';

  if (s.startsWith('data:image/')) return s;

  if (s.startsWith('//')) {
    s = `https:${s}`;
  }

  if (/^https?:\/\//i.test(s)) {
    if (/googleusercontent\.com/i.test(s)) return s;
    if (/drive\.google\.com/i.test(s)) return googleDriveFileUrlToImageSrc(s);
    return s;
  }

  const base = import.meta.env.VITE_CLUB_FLAG_BASE_URL?.replace(/\/$/, '');
  if (base && !s.startsWith('/') && !s.startsWith('data:')) {
    return `${base}/${s.replace(/^\/+/, '')}`;
  }

  if (s.startsWith('/')) return s;

  const compact = s.replace(/\s/g, '');
  if (compact.length >= 24 && /^[A-Za-z0-9+/]+=*$/.test(compact)) {
    if (compact.startsWith('/9j')) return `data:image/jpeg;base64,${compact}`;
    if (compact.startsWith('iVBOR')) return `data:image/png;base64,${compact}`;
    if (compact.startsWith('R0lGOD')) return `data:image/gif;base64,${compact}`;
    if (compact.startsWith('UklGR')) return `data:image/webp;base64,${compact}`;
    return `data:image/png;base64,${compact}`;
  }

  return s;
}
