export function formatCount(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) return '—';
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
    roundingMode: 'trunc',
  }).format(value);
}
