"use client";

import { createContext, useContext, type ReactNode } from "react";

export type Theme = "loom" | "arcade" | "press";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

// Loom ships one committed visual identity — the neon "arcade" look.
// The multi-skin switcher has been retired; the theme is fixed.
const FIXED_THEME: Theme = "arcade";

const ThemeContext = createContext<ThemeContextValue>({
  theme: FIXED_THEME,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={{ theme: FIXED_THEME, setTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
