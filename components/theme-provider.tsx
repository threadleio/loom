"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "loom" | "arcade" | "press";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "loom",
  setTheme: () => {},
});

const STORAGE_KEY = "crowd-pulse-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("loom");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && ["loom", "arcade", "press"].includes(stored)) {
      setThemeState(stored);
      document.documentElement.dataset.theme = stored;
    }
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    localStorage.setItem(STORAGE_KEY, t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
