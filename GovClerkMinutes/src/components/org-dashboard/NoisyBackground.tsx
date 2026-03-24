import React from "react";

interface NoisyBackgroundProps {
  readonly children: React.ReactNode;
  readonly className?: string;
}

export function NoisyBackground({ children, className = "" }: Readonly<NoisyBackgroundProps>) {
  return (
    <div className={`fixed inset-0 bg-[#f0fcff] ${className}`}>
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />
      <div className="relative h-full overflow-hidden">{children}</div>
    </div>
  );
}
