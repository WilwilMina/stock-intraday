// Client-side mirror of the backend's symbol validation rule
// (backend/src/routes/stocks.ts). Kept as a small duplicated constant rather
// than a shared package: frontend/ and backend/ are separate packages with
// no workspace tooling between them, and this is the only rule shared.

const SYMBOL_PATTERN = /^[A-Za-z0-9.\-^=]{1,15}$/;

export function isValidSymbol(value: string): boolean {
  return SYMBOL_PATTERN.test(value);
}
