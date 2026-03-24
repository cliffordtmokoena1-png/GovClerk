import { useState, useEffect, useCallback } from "react";
import { MOBILE_BREAKPOINT } from "../constants";

const STORAGE_KEY = "mg-org-sidebar-expanded";

export interface OrgSidebarState {
  isExpanded: boolean;
  toggleSidebar: () => void;
  collapseSidebar: () => void;
  isMobileDrawerOpen: boolean;
  openMobileDrawer: () => void;
  closeMobileDrawer: () => void;
  isMobile: boolean;
}

function getInitialExpanded(): boolean {
  // Always return false for SSR and initial client render
  // localStorage is read in useEffect after mount to prevent hydration mismatch
  return false;
}

export function useOrgSidebar(): OrgSidebarState {
  const [isExpanded, setIsExpanded] = useState(getInitialExpanded);
  const [mounted, setMounted] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Read saved state from localStorage after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        setIsExpanded(JSON.parse(saved));
      }
    } catch {
      // Invalid JSON or localStorage unavailable, keep default
    }
  }, []);

  // Listen for storage changes from other hook instances
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue !== null) {
        try {
          setIsExpanded(JSON.parse(e.newValue));
        } catch {
          // Invalid JSON, ignore
        }
      }
    };

    globalThis.addEventListener("storage", handleStorage);
    return () => globalThis.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(isExpanded));
    }
  }, [isExpanded, mounted]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const collapseSidebar = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const openMobileDrawer = useCallback(() => {
    setIsMobileDrawerOpen(true);
  }, []);

  const closeMobileDrawer = useCallback(() => {
    setIsMobileDrawerOpen(false);
  }, []);

  return {
    isExpanded,
    toggleSidebar,
    collapseSidebar,
    isMobileDrawerOpen,
    openMobileDrawer,
    closeMobileDrawer,
    isMobile,
  };
}
