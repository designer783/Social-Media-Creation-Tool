import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Media Studio | Multi-Brand AI Creative Production SaaS",
  description:
    "Extract brand identities from websites, generate marketing copy, and produce three consistent, platform-ready social media design variations through a hybrid AI and deterministic rendering engine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
