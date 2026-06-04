import React from "react";

interface BadgeProps {
  type: "growth" | "risk" | "neutral" | "cat";
  children: React.ReactNode;
  className?: string;
  dotColor?: string;
}

export const Badge: React.FC<BadgeProps> = ({ type, children, className = "", dotColor }) => {
  const baseStyle = "inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold px-2.5 py-0.5 rounded-full tracking-wider uppercase whitespace-nowrap";
  
  const typeStyles = {
    growth: "bg-growth-bg text-growth",
    risk: "bg-risk-bg text-risk",
    neutral: "bg-neutral-bg text-neutral",
    cat: "bg-paper-3 text-ink-soft border border-line",
  };

  return (
    <span className={`${baseStyle} ${typeStyles[type]} ${className}`}>
      {type !== "cat" && (
        <span 
          className="w-1.5 h-1.5 rounded-full" 
          style={{ 
            backgroundColor: dotColor || (type === "growth" ? "var(--growth)" : type === "risk" ? "var(--risk)" : "var(--neutral)") 
          }} 
        />
      )}
      {children}
    </span>
  );
};
