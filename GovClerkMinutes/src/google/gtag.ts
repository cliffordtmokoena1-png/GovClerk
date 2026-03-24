export function getGtag(): Gtag.Gtag | null {
  if (typeof window === "undefined" || typeof window.gtag === "undefined") {
    return null;
  }
  return window.gtag;
}
