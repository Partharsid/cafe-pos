import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RR Cafe POS | RR Downtown Arcade",
  description: "Cloud POS & QR Table Ordering System for RR Downtown Arcade",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col arcade-bg">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "rgba(5, 5, 10, 0.9)",
              color: "#f8f8f8",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(24px)",
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
