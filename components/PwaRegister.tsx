"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function inStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PwaRegister() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register(`${base}/sw.js`).then((registration) => registration.update());
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!inStandalone()) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      let path = `${url.pathname}${url.search}${url.hash}`;
      if (base && path.startsWith(base)) path = path.slice(base.length) || "/";
      router.push(path);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
