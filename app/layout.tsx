import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Upwork — Web Portfolio",
  description: "Eight production-minded web concepts for Upwork portfolio presentation.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
