import type { Metadata } from "next";
import "./globals.css";
import "@/theme/florin-globals.css";
import Providers from "@/providers/providers";
import { BRANDING } from "@/branding";
import { adminCopy } from "@/theme/copy";

export const metadata: Metadata = {
  title: `${BRANDING.name} — ${adminCopy.officeTitle}`,
  description: "Treasury operations and reserve governance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
