import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Hanken_Grotesk,
  Space_Grotesk,
  Space_Mono,
  Newsreader,
} from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Loom — Live Rooms",
  description: "In-house audience interaction platform for meetings and events",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVars = [
    bricolage.variable,
    hanken.variable,
    spaceGrotesk.variable,
    spaceMono.variable,
    newsreader.variable,
  ].join(" ");

  return (
    <html lang="en" data-theme="arcade" className={`${fontVars} h-full antialiased`}>
      <body className="min-h-full flex flex-col" style={{ fontFamily: "var(--body)", color: "var(--ink)", background: "var(--bg)" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
