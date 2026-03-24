import { useEffect, useState } from "react";

// Gets the device ID from localStorage, or creates one if it doesn't exist yet.
export function useDeviceId(): string | undefined {
  const [deviceId, setDeviceId] = useState<string>();

  useEffect(() => {
    const key = "gc_device_id";
    let id = window.localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(key, id);
    }
    setDeviceId(id);
  }, []);

  return deviceId;
}
