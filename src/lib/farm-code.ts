/**
 * Identificador alfanumérico corto por granja (formato `7K4M2P`).
 *
 * - 6 caracteres en mayúsculas sobre alfabeto seguro de 31 símbolos
 *   (excluye 0, 1, I, L, O para evitar confusión visual en campo/impresos).
 * - Los primeros 5 caracteres son aleatorios y el 6.º es dígito verificador
 *   ponderado Mod-31 ([3, 7, 11, 17, 23]), capaz de detectar 100% de errores de
 *   1 carácter y 100% de transposiciones adyacentes sin consultar base de datos.
 */

export const FARM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ" as const;
export const FARM_CODE_PREFIX_LENGTH = 5;
export const FARM_CODE_LENGTH = 6;
export const FARM_CODE_WEIGHTS = [3, 7, 11, 17, 23] as const;

export const FARM_CODE_REGEX = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BLOCKED_SUBSTRINGS = [
  "PUTA",
  "PUTO",
  "CACA",
  "CULO",
  "PENE",
  "TETA",
  "JOTO",
  "MAMA",
  "FVCK",
  "FUCK",
  "SHIT",
  "CUNT",
  "DICK",
  "PORN",
  "SEXO",
  "KAKA",
  "P3N3",
  "M4M4",
] as const;

/** Normaliza entrada humana (`" 7k4-m2p "` -> `"7K4M2P"`). Mantiene dígitos/letras para detectar caracteres ambiguos (`0/O/1/I/L`). */
export function normalizeFarmCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Calcula el 6.º carácter verificador Mod-31 a partir de un prefijo de 5 símbolos válidos. */
export function computeFarmCodeCheckChar(prefix5: string): string | null {
  if (prefix5.length !== FARM_CODE_PREFIX_LENGTH) return null;
  let weightedSum = 0;
  for (let i = 0; i < FARM_CODE_PREFIX_LENGTH; i++) {
    const idx = FARM_CODE_ALPHABET.indexOf(prefix5[i]);
    if (idx < 0) return null;
    weightedSum += idx * FARM_CODE_WEIGHTS[i];
  }
  return FARM_CODE_ALPHABET[weightedSum % FARM_CODE_ALPHABET.length];
}

/** Verifica formato básico (6 caracteres del alfabeto seguro, sin 0/O/1/I/L). */
export function isValidFarmCodeFormat(raw: unknown): boolean {
  const normalized = normalizeFarmCode(raw);
  return FARM_CODE_REGEX.test(normalized);
}

/** Verifica formato + dígito verificador Mod-31. */
export function isValidFarmCode(raw: unknown): boolean {
  const normalized = normalizeFarmCode(raw);
  if (!FARM_CODE_REGEX.test(normalized)) return false;
  const expected = computeFarmCodeCheckChar(normalized.slice(0, FARM_CODE_PREFIX_LENGTH));
  return expected !== null && expected === normalized[FARM_CODE_LENGTH - 1];
}

/** Devuelve true cuando la cadena es un UUID v1-v5 válido. */
export function isUuidString(raw: unknown): boolean {
  return typeof raw === "string" && UUID_REGEX.test(raw.trim());
}

/** Explica al usuario exactamente qué falló al digitar un código de granja, o `null` si es válido. */
export function describeFarmCodeError(raw: unknown): string | null {
  const normalized = normalizeFarmCode(raw);
  if (!normalized) {
    return "Ingresa el Código de Granja de 6 caracteres (ej. 7K4M2P).";
  }
  if (/[01ILO]/.test(normalized)) {
    return "El código de granja no usa 0, O, 1, I ni L. Revisa los caracteres parecidos.";
  }
  if (normalized.length !== FARM_CODE_LENGTH) {
    return `El código de granja debe tener exactamente ${FARM_CODE_LENGTH} caracteres (ej. 7K4M2P).`;
  }
  if (!FARM_CODE_REGEX.test(normalized)) {
    return "Usa únicamente letras y números válidos (sin caracteres especiales).";
  }
  if (!isValidFarmCode(normalized)) {
    return "El código de granja tiene un error de escritura (verificador Mod-31 no coincide).";
  }
  return null;
}

function randomAlphabetChar(): string {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function") {
    throw new Error("Web Crypto API no disponible para generar códigos de granja seguros.");
  }
  const alphabetLen = FARM_CODE_ALPHABET.length; // 31
  const maxUnbiased = Math.floor(256 / alphabetLen) * alphabetLen; // 248
  const buf = new Uint8Array(1);
  while (true) {
    cryptoObj.getRandomValues(buf);
    if (buf[0] < maxUnbiased) {
      return FARM_CODE_ALPHABET[buf[0] % alphabetLen];
    }
  }
}

/** Genera un código candidato de 6 caracteres (5 aleatorios + 1 verificador Mod-31) sin palabras bloqueadas. */
export function generateFarmCodeCandidate(): string {
  for (let attempt = 0; attempt < 32; attempt++) {
    let prefix = "";
    for (let i = 0; i < FARM_CODE_PREFIX_LENGTH; i++) {
      prefix += randomAlphabetChar();
    }
    const check = computeFarmCodeCheckChar(prefix);
    if (!check) continue;
    const candidate = `${prefix}${check}`;
    if (!BLOCKED_SUBSTRINGS.some((word) => candidate.includes(word))) {
      return candidate;
    }
  }
  throw new Error("No se pudo generar un código de granja candidato válido.");
}
