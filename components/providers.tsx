"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "./theme-provider";
import { SkinOverlay } from "./skin-overlay";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <SkinOverlay />
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
