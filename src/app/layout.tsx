import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";

import { ToastProvider } from "@/components/toast";
import "./globals.css";

/**
 * One family, doing everything. Figtree is warm and slightly rounded, which
 * suits a tool used by people who do not think of themselves as software
 * users. Times use its tabular figures rather than a separate monospace,
 * which read as technical.
 */
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Studio 954",
    template: "%s · Studio 954",
  },
  description: "Booking and studio management for Studio 954.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
