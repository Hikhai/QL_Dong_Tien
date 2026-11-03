import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import { StoreProvider } from "@/components/Store";
import "./globals.css";

const font = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Thu Chi — Dòng tiền & Công nợ",
  description: "Theo dõi dòng tiền gối đầu từng ngày, ngân sách 50/30/20 và công nợ trả nhiều đợt.",
  applicationName: "Thu Chi",
  manifest: "./manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
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
      <body className={font.className}>
        <PwaRegister />
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
