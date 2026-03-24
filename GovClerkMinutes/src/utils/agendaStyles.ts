export function getAgendaItemBackgroundClass(isCurrent: boolean, isCompleted: boolean): string {
  if (isCurrent) {
    return "bg-accent border-l-4 border-l-primary";
  }
  if (isCompleted) {
    return "bg-green-50/50";
  }
  return "hover:bg-muted/50";
}

export function getAgendaItemTitleClass(isCurrent: boolean, isCompleted: boolean): string {
  if (isCurrent) {
    return "font-semibold text-primary";
  }
  if (isCompleted) {
    return "text-muted-foreground line-through";
  }
  return "text-foreground";
}
