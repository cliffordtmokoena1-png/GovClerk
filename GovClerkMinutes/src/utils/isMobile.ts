import { IncomingHttpHeaders } from "http";
import { userAgent } from "next/server";

export default function isMobile(headers: IncomingHttpHeaders): boolean {
  const formattedHeaders = new Headers(Object.entries(headers) as Array<[string, string]>);
  return userAgent({ headers: formattedHeaders }).device.type === "mobile";
}
