export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

export function isProd(): boolean {
  return !isDev();
}

export function isPreview(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
}

export function forceProdServerInDev(): boolean {
  return process.env.NEXT_PUBLIC_USE_PROD_SERVER_IN_DEV != null;
}
