import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import { StoreProvider } from "@/components/Store";
import "./globals.css";

const font = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
});

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Thu Chi — Dòng tiền & Công nợ",
  description: "Theo dõi dòng tiền gối đầu từng ngày, ngân sách 50/30/20 và công nợ trả nhiều đợt.",
  applicationName: "Thu Chi",
  manifest: `${base}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${base}/icon.svg`, type: "image/svg+xml" },
      { url: `${base}/icon-192.png`, sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: `${base}/icon-192.png`, sizes: "192x192" }],
  },
  appleWebApp: { capable: true, title: "Thu Chi", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1f6b4a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={font.className}>
        <PwaRegister />
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
