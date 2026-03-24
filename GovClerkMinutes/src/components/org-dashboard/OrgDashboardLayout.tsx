import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { UserButton, useUser } from "@clerk/nextjs";
import { useOrgSidebar } from "./hooks/useOrgSidebar";
import { useOrgContext } from "@/contexts/OrgContext";
import { NoisyBackground } from "./NoisyBackground";
import { OrgContentContainer } from "./OrgContentContainer";
import { OrgSidebar } from "./OrgSidebar";
import { OrgMobileDrawer } from "./OrgMobileDrawer";
import { OrgAppBar } from "./OrgAppBar";
import { OrgAppBarProvider, useOrgAppBar } from "./context/OrgAppBarContext";
import { OrgAppBarActionButton } from "./OrgAppBarActionButton";
import { Toaster } from "@/components/ui/sonner";

interface OrgDashboardLayoutProps {
  readonly children: React.ReactNode;
  readonly title?: string;
  readonly className?: string;
  readonly fullWidth?: boolean;
}

function OrgDashboardLayoutInner({
  children,
  title,
  className = "",
  fullWidth = false,
}: Readonly<OrgDashboardLayoutProps>) {
  const router = useRouter();
  const { user } = useUser();
  const { orgName } = useOrgContext();
  const {
    isExpanded,
    toggleSidebar,
    isMobileDrawerOpen,
    openMobileDrawer,
    closeMobileDrawer,
    isMobile,
  } = useOrgSidebar();
  const { title: contextTitle, actions } = useOrgAppBar();
  // Context title of null means "use default", any other value is explicit
  const defaultTitle = title || "Dashboard";
  const displayTitle = contextTitle ?? defaultTitle;
  const displayName = user?.firstName || user?.username || "User";

  // Close mobile drawer when route changes
  useEffect(() => {
    closeMobileDrawer();
  }, [router.pathname, closeMobileDrawer]);

  return (
    <NoisyBackground>
      {isMobile ? (
        <>
          <OrgAppBar
            defaultTitle={defaultTitle}
            onMenuClick={isMobileDrawerOpen ? closeMobileDrawer : openMobileDrawer}
            isMobileDrawerOpen={isMobileDrawerOpen}
          />

          <div className={`h-screen flex flex-col pt-12 ${className}`}>
            <OrgContentContainer className="flex-1" fullWidth={fullWidth}>
              {children}
            </OrgContentContainer>
          </div>

          <OrgMobileDrawer isOpen={isMobileDrawerOpen} onClose={closeMobileDrawer} />
        </>
      ) : (
        <div className="flex h-screen">
          <OrgSidebar isExpanded={isExpanded} toggleSidebar={toggleSidebar} />
          <main className={`flex-1 overflow-auto flex flex-col ${className}`}>
            <div className="flex items-center h-12 px-4 shrink-0">
              <div className="flex-1 min-w-0">
                {typeof displayTitle === "string" ? (
                  <h1 className="text-lg font-semibold text-foreground truncate">{displayTitle}</h1>
                ) : (
                  displayTitle
                )}
              </div>
              {actions.length > 0 && (
                <>
                  <div className="flex items-center gap-2 ml-4">
                    {actions.map((action) => (
                      <OrgAppBarActionButton key={action.id} action={action} />
                    ))}
                  </div>
                  <div className="h-6 w-px bg-foreground/20 mx-3" />
                </>
              )}
              <div className="flex items-center gap-2">
                <UserButton
                  userProfileUrl="/a/account"
                  userProfileMode="navigation"
                  appearance={{
                    elements: {
                      avatarBox: "w-6 h-6",
                      userButtonTrigger: "p-0 border-none shadow-none focus:shadow-none",
                    },
                  }}
                />
                <div className="text-left">
                  <div className="text-xs font-medium text-foreground truncate">{displayName}</div>
                  {orgName && (
                    <div className="text-xs text-muted-foreground truncate">{orgName}</div>
                  )}
                </div>
              </div>
            </div>
            <OrgContentContainer className="flex-1" fullWidth={fullWidth}>
              {children}
            </OrgContentContainer>
          </main>
        </div>
      )}
    </NoisyBackground>
  );
}

export function OrgDashboardLayout(props: Readonly<OrgDashboardLayoutProps>) {
  return (
    <OrgAppBarProvider defaultTitle={props.title || "Dashboard"}>
      <OrgDashboardLayoutInner {...props} />
      <Toaster />
    </OrgAppBarProvider>
  );
}
