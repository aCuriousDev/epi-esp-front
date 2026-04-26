import { en, type EnKey } from "./en";

export type Vars = Record<string, string | number>;

export function t(key: EnKey, vars?: Vars): string {
  let s: string = en[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

export type { EnKey };
