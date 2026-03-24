export default function isFbIg(userAgent: string): boolean {
  return /FBAN/.test(userAgent) || /FBAV/.test(userAgent) || /Instagram/.test(userAgent);
}
