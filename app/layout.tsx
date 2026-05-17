import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "pod2md",
  description: "Convert podcast URLs into accurate markdown transcripts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
