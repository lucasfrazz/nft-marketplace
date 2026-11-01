/**
 * Substituto mínimo de `tough-cookie` para o bundle de navegador do MSW.
 *
 * A API simulada autentica por token Bearer (cabeçalho Authorization) e não
 * usa cookies. O armazenamento de cookies do MSW (msw/lib/core/utils/
 * cookieStore) só precisa de `Cookie.fromJSON`, `CookieJar` e
 * `MemoryCookieStore`; este stub mantém essa interface sem efeitos e remove
 * `tough-cookie` + `tldts` (~190 KB de código-fonte) do caminho crítico.
 * Aplicado via alias em vite.config.ts.
 */
export class Cookie {
  static fromJSON(): null {
    return null
  }
  toJSON() {
    return {}
  }
}

export class MemoryCookieStore {
  idx: Record<string, unknown> = {}
}

export class CookieJar {
  constructor(_store?: MemoryCookieStore) {
    void _store
  }
  getCookiesSync(): Cookie[] {
    return []
  }
  async setCookie(): Promise<void> {}
}
