import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Thu Chi — Dòng tiền & Công nợ",
    short_name: "Thu Chi",
    description: "Quản lý dòng tiền hằng ngày, ngân sách tháng và công nợ cá nhân",
    start_url: "/",
    display: "standalone",
    background_color: "#efece6",
    theme_color: "#1f6b4a",
    lang: "vi",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
