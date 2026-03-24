import { connect } from "@planetscale/database";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";

export type Settings = {
  "send-email-when-minutes-done": {
    value: boolean;
  };
  "selected-template-id": {
    value: string;
  };
};

export const SETTINGS: Settings = {
  "send-email-when-minutes-done": {
    value: false,
  },
  "selected-template-id": {
    value: "GovClerkMinutes-template",
  },
} as const;

export type SettingKeys = keyof typeof SETTINGS;

export type SettingsData = Partial<Record<SettingKeys, unknown>>;

// Map of setting key -> value (not the defaultValue object)
export type SettingsValues = { [K in keyof Settings]: Settings[K]["value"] };

export function applyDefaults(incoming?: Partial<SettingsValues>): SettingsValues {
  const result = {} as Partial<SettingsValues>;
  (Object.keys(SETTINGS) as SettingKeys[]).forEach((key) => {
    const def = SETTINGS[key].value;
    const provided = incoming?.[key];
    result[key as keyof SettingsValues] = (provided === undefined ? def : (provided as any)) as any;
  });
  return result as SettingsValues;
}

export async function fetchSettings(userId: string): Promise<SettingsValues> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  let rows: { setting_key: string; setting_value: unknown }[] = [];
  try {
    rows = await conn
      .execute<{
        setting_key: string;
        setting_value: unknown;
      }>("SELECT setting_key, setting_value FROM gc_settings WHERE user_id = ?", [userId])
      .then((result) => result.rows);
  } catch (err) {
    if (isUnknownColumnOrMissingTableError(err)) {
      console.warn(
        "[settings] gc_settings table not found (schema migration pending). " +
          "Returning default settings."
      );
      return applyDefaults({});
    }
    throw err;
  }

  const data: Partial<SettingsValues> = {};
  for (const r of rows) {
    const v = r.setting_value as any;
    try {
      // Try parsing as JSON first (for properly encoded settings)
      data[r.setting_key as SettingKeys] = JSON.parse(v);
    } catch {
      // If parsing fails, use the raw value (for legacy plain string settings)
      data[r.setting_key as SettingKeys] = v;
    }
  }

  const merged = applyDefaults(data);

  return merged;
}
