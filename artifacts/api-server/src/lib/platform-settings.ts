import { db } from "@workspace/db";
import { platformSettings } from "@workspace/db";

// Authoritative catalog of owner-editable technical settings. The key/value
// table only stores overrides; everything about a setting (type, default,
// label, help text, bounds) lives here so the admin UI never edits arbitrary
// keys and SECRETS ARE NEVER STORED — API keys/passwords stay in the env only.
export type SettingType = "boolean" | "number" | "string";

export type SettingDef = {
  key: string;
  type: SettingType;
  label: string;
  description: string;
  default: boolean | number | string;
  // Optional bounds for numeric settings.
  min?: number;
  max?: number;
  // Optional max length for string settings.
  maxLength?: number;
};

export const SETTINGS_CATALOG: SettingDef[] = [
  {
    key: "maintenanceMode",
    type: "boolean",
    label: "Tryb konserwacji",
    description:
      "Gdy włączony, na stronie głównej wyświetla się komunikat o przerwie technicznej. Nie blokuje panelu administratora.",
    default: false,
  },
  {
    key: "maintenanceMessage",
    type: "string",
    label: "Komunikat przerwy technicznej",
    description: "Treść komunikatu pokazywanego uczniom w trybie konserwacji.",
    default: "Trwa przerwa techniczna. Wrócimy wkrótce.",
    maxLength: 300,
  },
  {
    key: "registrationEnabled",
    type: "boolean",
    label: "Rejestracja włączona",
    description: "Gdy wyłączona, nowi użytkownicy nie mogą zakładać kont.",
    default: true,
  },
  {
    key: "purchaseEnabled",
    type: "boolean",
    label: "Sprzedaż włączona",
    description: "Gdy wyłączona, uczniowie nie mogą rozpocząć zakupu kursu.",
    default: true,
  },
  {
    key: "supportEmail",
    type: "string",
    label: "E-mail wsparcia",
    description: "Adres kontaktowy pokazywany uczniom (np. w stopce). To NIE jest sekret.",
    default: "kontakt@fizyka7.pl",
    maxLength: 200,
  },
  {
    key: "maxAiChecksPerDay",
    type: "number",
    label: "Limit sprawdzeń AI / dzień",
    description: "Maksymalna liczba sprawdzeń zadań przez AI na użytkownika dziennie (0 = bez limitu).",
    default: 50,
    min: 0,
    max: 100000,
  },
  {
    key: "announcementText",
    type: "string",
    label: "Pasek ogłoszeń",
    description: "Tekst paska ogłoszeń na górze strony (pusty = ukryty).",
    default: "",
    maxLength: 300,
  },
];

const CATALOG_BY_KEY = new Map(SETTINGS_CATALOG.map((s) => [s.key, s]));

export function getSettingDef(key: string): SettingDef | undefined {
  return CATALOG_BY_KEY.get(key);
}

export type SettingValue = boolean | number | string;

function coerce(def: SettingDef, raw: string | undefined): SettingValue {
  if (raw === undefined) return def.default;
  switch (def.type) {
    case "boolean":
      return raw === "true" || raw === "1";
    case "number": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : (def.default as number);
    }
    default:
      return raw;
  }
}

// Validate + normalise an incoming value against its catalog definition.
// Returns the string to persist, or a Polish error message.
export function validateSetting(
  def: SettingDef,
  value: unknown,
): { ok: true; stored: string } | { ok: false; error: string } {
  switch (def.type) {
    case "boolean": {
      const b = value === true || value === "true" || value === 1 || value === "1";
      const isFalse = value === false || value === "false" || value === 0 || value === "0";
      if (!b && !isFalse) return { ok: false, error: `${def.label}: oczekiwano wartości logicznej` };
      return { ok: true, stored: b ? "true" : "false" };
    }
    case "number": {
      const n = Number(value);
      if (!Number.isFinite(n)) return { ok: false, error: `${def.label}: oczekiwano liczby` };
      if (def.min !== undefined && n < def.min)
        return { ok: false, error: `${def.label}: wartość nie może być mniejsza niż ${def.min}` };
      if (def.max !== undefined && n > def.max)
        return { ok: false, error: `${def.label}: wartość nie może być większa niż ${def.max}` };
      return { ok: true, stored: String(Math.round(n)) };
    }
    default: {
      const s = value == null ? "" : String(value);
      if (def.maxLength !== undefined && s.length > def.maxLength)
        return { ok: false, error: `${def.label}: maksymalnie ${def.maxLength} znaków` };
      return { ok: true, stored: s };
    }
  }
}

// Read every setting merged with its catalog default. Returns rich entries the
// admin UI can render (label, description, type, current value).
export async function getPlatformSettings(): Promise<
  Array<SettingDef & { value: SettingValue }>
> {
  const rows = await db.select().from(platformSettings);
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return SETTINGS_CATALOG.map((def) => ({
    ...def,
    value: coerce(def, byKey.get(def.key)),
  }));
}

// Read a single resolved setting value by key (or its default).
export async function getSettingValue(key: string): Promise<SettingValue | undefined> {
  const def = CATALOG_BY_KEY.get(key);
  if (!def) return undefined;
  const all = await getPlatformSettings();
  return all.find((s) => s.key === key)?.value;
}
