export function readStoredJson(key: string): unknown | null {
  try {
    const storedValue = localStorage.getItem(key)
    return storedValue ? JSON.parse(storedValue) : null
  } catch {
    try {
      localStorage.removeItem(key)
    } catch {
      // Ignore storage access failures and fall back to in-memory defaults.
    }
    return null
  }
}

export function writeStoredJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable or full; the in-memory game must keep working.
  }
}

export function readStoredText(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStoredText(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable or full; the in-memory game must keep working.
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
