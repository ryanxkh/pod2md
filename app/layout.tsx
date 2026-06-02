import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SonnerToaster } from "@/components/sonner-toaster";
import { AppShell } from "@/components/app-shell";
import "sonner/dist/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "pod2md",
  description: "Convert podcast/video URLs into accurate markdown transcripts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className={GeistSans.className}>
        <AppShell>{children}</AppShell>
        <SonnerToaster />
      </body>
    </html>
  );
}
