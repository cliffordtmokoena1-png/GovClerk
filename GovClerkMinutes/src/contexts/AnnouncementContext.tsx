import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/router";
import { Announcement } from "@/types/announcement";

type AnnouncementContextType = {
  announcements: Announcement[];
  addAnnouncement: (announcement: Omit<Announcement, "id">) => string;
  dismissAnnouncement: (id: string) => void;
  clearAnnouncements: () => void;
  clearTranscriptAnnouncements: (transcriptId: number) => void;
};

const AnnouncementContext = createContext<AnnouncementContextType | undefined>(undefined);

export function AnnouncementProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const addAnnouncement = useCallback((announcement: Omit<Announcement, "id">): string => {
    let returnId = "";

    setAnnouncements((prev) => {
      const existing = prev.find(
        (a) =>
          a.text === announcement.text &&
          a.variant === announcement.variant &&
          a.transcriptId === announcement.transcriptId
      );

      if (existing) {
        returnId = existing.id;
        return prev;
      }

      const id = `announcement-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newAnnouncement: Announcement = { ...announcement, id };
      returnId = id;

      return [...prev, newAnnouncement];
    });

    return returnId;
  }, []);

  const dismissAnnouncement = useCallback((id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAnnouncements = useCallback(() => {
    setAnnouncements([]);
  }, []);

  const clearTranscriptAnnouncements = useCallback((transcriptId: number) => {
    setAnnouncements((prev) => prev.filter((a) => a.transcriptId !== transcriptId));
  }, []);

  useEffect(() => {
    const handleRouteChangeStart = () => {
      setAnnouncements((prev) => prev.filter((a) => a.transcriptId == null));
    };

    router.events.on("routeChangeStart", handleRouteChangeStart);
    return () => {
      router.events.off("routeChangeStart", handleRouteChangeStart);
    };
  }, [router.events]);

  return (
    <AnnouncementContext.Provider
      value={{
        announcements,
        addAnnouncement,
        dismissAnnouncement,
        clearAnnouncements,
        clearTranscriptAnnouncements,
      }}
    >
      {children}
    </AnnouncementContext.Provider>
  );
}

export function useAnnouncements() {
  const context = useContext(AnnouncementContext);
  if (context === undefined) {
    throw new Error("useAnnouncements must be used within an AnnouncementProvider");
  }
  return context;
}
