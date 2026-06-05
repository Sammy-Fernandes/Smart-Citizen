import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./map.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Smart Citizen Admin",
  description: "Administrative Portal for Smart Citizen App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
