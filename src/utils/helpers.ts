export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function slugify(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function initials(text: string): string {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '•';
  return cleaned.split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

export function nextPow2(num: number): number {
  let n = 1;
  while (n < Math.max(1, num)) n *= 2;
  return n;
}

export function parseNum(v: string | number): number {
  const n = parseInt(String(v || '').replace(/\D+/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export function formatDateTime(dt: string): string {
  if (!dt) return '';
  try {
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return '';
    const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${weekdays[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

export function displayGameCode(code: string): string {
  if (!code) return '';
  const digits = String(code).replace(/\D+/g, '');
  return digits ? `JOGO${digits}` : String(code);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(''); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 240, maxH = 160;
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => resolve(String(reader.result || ''));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Falha ao ler imagem.'));
    reader.readAsDataURL(file);
  });
}
