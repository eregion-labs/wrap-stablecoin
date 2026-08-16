import type { Metadata } from "next";
import "./globals.css";
import "@/theme/florin-globals.css";
import Providers from "@/providers/providers";
import { BRANDING } from "@/branding";

export const metadata: Metadata = {
  title: BRANDING.name,
  description: BRANDING.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
