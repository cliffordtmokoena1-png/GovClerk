export function capitalizeName(name: string): string {
  return name
    .trim()
    .split(/\s+/) // split on one or more spaces
    .map((word) =>
      word.toLowerCase().replace(/(^[a-z])|([-'][a-z])/g, (match) => match.toUpperCase())
    )
    .join(" ");
}
