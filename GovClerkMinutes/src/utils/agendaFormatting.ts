import type { MgAgendaItemWithRelations, MgMotion } from "@/types/agenda";
import { formatDateLong } from "@/utils/formatters";

export const MAX_NESTING_LEVEL = 5;

export function toRoman(num: number): string {
  const romanNumerals: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let result = "";
  for (const [value, symbol] of romanNumerals) {
    while (num >= value) {
      result += symbol;
      num -= value;
    }
  }
  return result;
}

export function toLetter(num: number, lowercase: boolean): string {
  const letter = String.fromCharCode(64 + num);
  return lowercase ? letter.toLowerCase() : letter;
}

export function getItemPrefix(level: number, index: number): string {
  const num = index + 1;
  switch (level) {
    case 0:
      return `${toRoman(num)}.`;
    case 1:
      return `${toLetter(num, false)}.`;
    case 2:
      return `${num}.`;
    case 3:
      return `${toLetter(num, true)}.`;
    case 4:
      return `(${num})`;
    default:
      return `${num}.`;
  }
}

function getMotionStatusLabel(motion: MgMotion): string {
  if (motion.is_withdrawn) {
    return "withdrawn";
  }
  if (motion.is_tabled) {
    return "tabled";
  }

  const votesFor = motion.votes_for ?? 0;
  const votesAgainst = motion.votes_against ?? 0;

  if (votesFor > 0 || votesAgainst > 0) {
    return votesFor > votesAgainst ? "passed" : "failed";
  }

  return "pending";
}

export function generateTextAgenda(
  title: string,
  date: string,
  tree: MgAgendaItemWithRelations[],
  options?: { includeSeparator?: boolean; location?: string }
): string {
  const lines: string[] = [];

  lines.push(title.toUpperCase());
  lines.push("AGENDA");
  lines.push("");
  lines.push(formatDateLong(date));
  if (options?.location) {
    lines.push(`Location: ${options.location}`);
  }
  lines.push("");

  if (options?.includeSeparator) {
    lines.push("=".repeat(60));
    lines.push("");
  }

  const renderItem = (item: MgAgendaItemWithRelations, level: number, index: number) => {
    const indent = "    ".repeat(level);
    const prefix = getItemPrefix(level, index);

    lines.push(`${indent}${prefix} ${item.title}`);

    if (item.description) {
      const descLines = item.description.split("\n");
      for (const line of descLines) {
        lines.push(`${indent}    ${line}`);
      }
    }

    if (item.motions && item.motions.length > 0) {
      lines.push("");
      lines.push(`${indent}    Motions:`);
      item.motions.forEach((motion) => {
        const status = getMotionStatusLabel(motion);
        const moverSeconder = [
          motion.mover ? `Moved by: ${motion.mover}` : null,
          motion.seconder ? `Seconded by: ${motion.seconder}` : null,
        ]
          .filter(Boolean)
          .join(", ");

        lines.push(`${indent}    - ${motion.title} [${status.toUpperCase()}]`);
        if (motion.description) {
          lines.push(`${indent}      ${motion.description}`);
        }
        if (moverSeconder) {
          lines.push(`${indent}      (${moverSeconder})`);
        }
      });
    }

    lines.push("");

    if (item.children && item.children.length > 0) {
      item.children.forEach((child, childIndex) => {
        renderItem(child, level + 1, childIndex);
      });
    }
  };

  tree.forEach((item, index) => {
    renderItem(item, 0, index);
  });

  return lines.join("\n");
}

export function generateMarkdownAgenda(
  title: string,
  date: string,
  tree: MgAgendaItemWithRelations[],
  options?: { includeSeparator?: boolean; location?: string }
): string {
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push("");
  lines.push("## AGENDA");
  lines.push("");
  lines.push(`**Date:** ${formatDateLong(date)}`);
  if (options?.location) {
    lines.push(`**Location:** ${options.location}`);
  }
  lines.push("");

  if (options?.includeSeparator) {
    lines.push("---");
    lines.push("");
  }

  const renderItem = (item: MgAgendaItemWithRelations, level: number, index: number) => {
    const indent = "  ".repeat(level);
    const prefix = getItemPrefix(level, index);

    lines.push(`${indent}**${prefix}** ${item.title}`);

    if (item.description) {
      lines.push("");
      const descLines = item.description.split("\n");
      for (const line of descLines) {
        lines.push(`${indent}> ${line}`);
      }
    }

    if (item.motions && item.motions.length > 0) {
      lines.push("");
      lines.push(`${indent}**Motions:**`);
      item.motions.forEach((motion) => {
        const status = getMotionStatusLabel(motion);
        const moverSeconder = [
          motion.mover ? `Moved by: ${motion.mover}` : null,
          motion.seconder ? `Seconded by: ${motion.seconder}` : null,
        ]
          .filter(Boolean)
          .join(" | ");

        lines.push(`${indent}- **${motion.title}** - Status: *${status}*`);
        if (motion.description) {
          lines.push(`${indent}  ${motion.description}`);
        }
        if (moverSeconder) {
          lines.push(`${indent}  *(${moverSeconder})*`);
        }
      });
    }

    lines.push("");

    if (item.children && item.children.length > 0) {
      item.children.forEach((child, childIndex) => {
        renderItem(child, level + 1, childIndex);
      });
    }
  };

  tree.forEach((item, index) => {
    renderItem(item, 0, index);
  });

  return lines.join("\n");
}
