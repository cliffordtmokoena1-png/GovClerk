"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useOrganization } from "@clerk/nextjs";

type OrgContextValue = {
  mode: "personal" | "org";
  orgId: string | null;
  orgName: string | null;
  orgSlug: string | null;
  orgImageUrl: string | null;
};

const OrgContext = createContext<OrgContextValue>({
  mode: "personal",
  orgId: null,
  orgName: null,
  orgSlug: null,
  orgImageUrl: null,
});

export function OrgContextProvider({ children }: { children: ReactNode }) {
  const { organization, isLoaded } = useOrganization();
  const [contextValue, setContextValue] = useState<OrgContextValue>({
    mode: "personal",
    orgId: null,
    orgName: null,
    orgSlug: null,
    orgImageUrl: null,
  });

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (organization) {
      setContextValue({
        mode: "org",
        orgId: organization.id,
        orgName: organization.name,
        orgSlug: organization.slug || null,
        orgImageUrl: organization.imageUrl || null,
      });
    } else {
      setContextValue({
        mode: "personal",
        orgId: null,
        orgName: null,
        orgSlug: null,
        orgImageUrl: null,
      });
    }
  }, [organization, isLoaded]);

  return <OrgContext.Provider value={contextValue}>{children}</OrgContext.Provider>;
}

export function useOrgContext() {
  return useContext(OrgContext);
}
