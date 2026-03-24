export function isLocalUri(uri: string | null | undefined): boolean {
  if (uri == null) {
    return false;
  }
  const protocol = uri.toLowerCase().split(":")[0];
  return protocol === "file" || protocol === "data" || protocol === "blob";
}

export function isRemoteUri(uri: string | null | undefined): boolean {
  return !isLocalUri(uri);
}
