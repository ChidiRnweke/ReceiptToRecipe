export function parseStringList(input: string | null | undefined, options?: { maxItems?: number; maxLength?: number }) {
  const maxItems = options?.maxItems ?? 20;
  const maxLength = options?.maxLength ?? 64;

  if (!input) return [] as string[];

  const items = input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.slice(0, maxLength));

  return Array.from(new Set(items)).slice(0, maxItems);
}

export function parseNumber(
  value: string | null | undefined,
  opts: { min?: number; max?: number; fallback?: number | null } = {}
) {
  const num = value ? Number(value) : NaN;
  if (Number.isNaN(num)) return opts.fallback ?? null;

  const min = opts.min ?? -Infinity;
  const max = opts.max ?? Infinity;
  const bounded = Math.min(Math.max(num, min), max);
  return bounded;
}

export function requireString(value: string | null | undefined, message: string) {
  if (!value || !value.trim()) {
    throw new Error(message);
  }
  return value.trim();
}
