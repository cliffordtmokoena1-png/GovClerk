import React from "react";

type Props = Readonly<{
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}>;

export function OrgContentContainer({ children, className = "", fullWidth = false }: Props) {
  if (fullWidth) {
    return (
      <div
        className={`bg-card rounded-md mr-1 md:mr-2 ml-1 md:ml-0 mb-2 overflow-y-auto overflow-x-hidden h-full border-2 border-primary/30 flex flex-col ${className}`}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={`bg-card rounded-md mr-1 md:mr-2 ml-1 md:ml-0 mb-2 overflow-y-auto overflow-x-hidden border-2 border-primary/30 ${className}`}
    >
      <div className="max-w-5xl mx-auto w-full h-full">{children}</div>
    </div>
  );
}
