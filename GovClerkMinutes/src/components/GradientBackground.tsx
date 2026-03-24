import React from "react";

interface GradientBackgroundProps {
  className?: string;
}

export const GradientBackground: React.FC<GradientBackgroundProps> = ({ className }) => {
  const baseClasses = "fixed inset-0 w-full h-full overflow-hidden";
  const combinedClasses = className ? `${baseClasses} ${className}` : baseClasses;

  return (
    <div className={combinedClasses}>
      {/* Pure white background */}
      <div className="absolute inset-0 bg-white" />
    </div>
  );
};

export default GradientBackground;
