class MenuStateManager {
  private menuStates = new Map<string, boolean>();
  private listeners = new Map<string, Set<(isOpen: boolean) => void>>();

  setMenuState(key: string, isOpen: boolean) {
    this.menuStates.set(key, isOpen);
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach((listener) => listener(isOpen));
    }
  }

  getMenuState(key: string): boolean {
    return this.menuStates.get(key) || false;
  }

  subscribe(key: string, listener: (isOpen: boolean) => void) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    // Return unsubscribe function
    return () => {
      const keyListeners = this.listeners.get(key);
      if (keyListeners) {
        keyListeners.delete(listener);
        if (keyListeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  closeAllMenus() {
    this.menuStates.forEach((_, key) => {
      this.setMenuState(key, false);
    });
  }
}

export const menuStateManager = new MenuStateManager();
