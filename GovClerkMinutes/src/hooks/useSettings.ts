import useSWR from "swr";
import { SettingKeys, Settings, SettingsValues } from "@/settings/settings";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch settings");
  }
  return (await res.json()) as SettingsValues;
};

export function useSettings() {
  const { data, isLoading, mutate } = useSWR<SettingsValues>("/api/get-settings", fetcher, {
    revalidateOnFocus: false,
  });

  async function setSetting<K extends SettingKeys>(key: K, value: Settings[K]["value"]) {
    const optimistic = { ...(data ?? {}), [key]: value } as SettingsValues;
    await mutate(optimistic, { revalidate: false });
    try {
      const res = await fetch("/api/set-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        throw new Error("Failed to save setting");
      }
      // Revalidate in the background — don't await or throw if it fails
      mutate().catch((err) => {
        console.warn("Settings revalidation failed after save:", err);
      });
    } catch (e) {
      await mutate(); // revert by revalidating from server
      throw e;
    }
  }

  return { isLoading, settings: data, setSetting } as const;
}
