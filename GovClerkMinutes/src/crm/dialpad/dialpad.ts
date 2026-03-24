/// Launches the Dialpad app with a phone number prefilled.
export function getDialpadUrl(phone: string): string {
  return `https://dialpad.com/launch?phone=${phone}`;
}
