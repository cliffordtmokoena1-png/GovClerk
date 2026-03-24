type Props = {
  dotColor?: string;
  dotSize?: number;
  gap?: number;
  fadeFrom?: "center" | "edges";
  className?: string;
};

export default function DotPattern({
  dotColor = "rgba(0,0,0,0.15)",
  dotSize = 1.5,
  gap = 20,
  fadeFrom = "center",
  className = "",
}: Props) {
  const dotPattern = `radial-gradient(circle, ${dotColor} ${dotSize}px, transparent ${dotSize}px)`;

  const maskImage =
    fadeFrom === "center"
      ? "radial-gradient(ellipse at center, black 0%, transparent 70%)"
      : "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)";

  const maskComposite = fadeFrom === "edges" ? "intersect" : undefined;

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[1] ${className}`}
      style={{
        backgroundImage: dotPattern,
        backgroundSize: `${gap}px ${gap}px`,
        maskImage,
        WebkitMaskImage: maskImage,
        maskComposite,
        WebkitMaskComposite: maskComposite === "intersect" ? "source-in" : undefined,
      }}
      aria-hidden="true"
    />
  );
}
