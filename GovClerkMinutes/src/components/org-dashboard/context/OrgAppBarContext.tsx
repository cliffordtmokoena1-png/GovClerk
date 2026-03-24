import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
  type ComponentType,
} from "react";
import type { IconType } from "react-icons";

export interface OrgAppBarAction {
  id: string;
  icon: IconType;
  label: string;
  expanded?: boolean;
  bgColor?: string;
  textColor?: "white" | "black";
  dropdownComponent?: ComponentType<any>;
  dropdownProps?: Record<string, any>;
  onClick?: () => void;
  order?: number;
}

interface OrgAppBarContextValue {
  title: ReactNode | null;
  setTitle: (title: ReactNode | null) => void;
  actions: OrgAppBarAction[];
  registerAction: (action: OrgAppBarAction) => () => void;
  updateAction: (id: string, updates: Partial<OrgAppBarAction>) => void;
  removeAction: (id: string) => void;
}

const OrgAppBarContext = createContext<OrgAppBarContextValue | null>(null);

interface OrgAppBarProviderProps {
  readonly children: ReactNode;
  readonly defaultTitle?: string;
}

function removeActionById(actions: OrgAppBarAction[], id: string): OrgAppBarAction[] {
  return actions.filter((a) => a.id !== id);
}

export function OrgAppBarProvider({
  children,
  defaultTitle = "Dashboard",
}: Readonly<OrgAppBarProviderProps>) {
  const [title, setTitle] = useState<ReactNode | null>(null);
  const [actions, setActions] = useState<OrgAppBarAction[]>([]);

  const registerAction = useCallback((action: OrgAppBarAction) => {
    setActions((prev) => {
      const filtered = removeActionById(prev, action.id);
      return [...filtered, action].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });

    return () => {
      setActions((prev) => removeActionById(prev, action.id));
    };
  }, []);

  const updateAction = useCallback((id: string, updates: Partial<OrgAppBarAction>) => {
    setActions((prev) =>
      prev.map((action) => (action.id === id ? { ...action, ...updates } : action))
    );
  }, []);

  const removeAction = useCallback((id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      title,
      setTitle,
      actions,
      registerAction,
      updateAction,
      removeAction,
    }),
    [title, actions, registerAction, updateAction, removeAction]
  );

  return <OrgAppBarContext.Provider value={value}>{children}</OrgAppBarContext.Provider>;
}

export function useOrgAppBar() {
  const context = useContext(OrgAppBarContext);
  if (!context) {
    throw new Error("useOrgAppBar must be used within OrgAppBarProvider");
  }
  return context;
}

export function useOrgAppBarAction(action: OrgAppBarAction | null, deps: any[] = []) {
  const { registerAction } = useOrgAppBar();

  React.useEffect(() => {
    if (!action) {
      return;
    }
    return registerAction(action);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is spread intentionally for consumer flexibility
  }, [registerAction, action, ...deps]);
}

export function useOrgAppBarTitle(title: ReactNode, resetOnUnmount = true) {
  const { setTitle } = useOrgAppBar();

  React.useLayoutEffect(() => {
    setTitle(title);
    if (resetOnUnmount) {
      return () => setTitle(null);
    }
  }, [title, setTitle, resetOnUnmount]);
}

export function useOrgAppBarTitleWithKey(title: ReactNode, key: string, resetOnUnmount = true) {
  const { setTitle } = useOrgAppBar();

  React.useLayoutEffect(() => {
    setTitle(title);
    if (resetOnUnmount) {
      return () => setTitle(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key controls updates, not title
  }, [key, setTitle, resetOnUnmount]);
}
