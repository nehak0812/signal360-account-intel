import React from "react";

interface GaugeProps {
  value: string | number;
  subLabel: string;
  percentage: number; // 0 to 100
  strokeColor: string; // e.g. "var(--growth)"
  size?: number;
}

export const Gauge: React.FC<GaugeProps> = ({ 
  value, 
  subLabel, 
  percentage, 
  strokeColor, 
  size = 122 
}) => {
  const radius = 50;
  const strokeWidth = 11;
  const center = 60;
  const circumference = 2 * Math.PI * radius; // ~314.16
  const safePercentage = typeof percentage === "number" && !isNaN(percentage) ? percentage : 0;
  const offset = circumference - (safePercentage / 100) * circumference;

  return (
    <div 
      className="relative flex-shrink-0" 
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 120 120" className="w-full h-full">
        {/* Background Circle */}
        <circle 
          cx={center} 
          cy={center} 
          r={radius} 
          fill="none" 
          stroke="var(--line)" 
          strokeWidth={strokeWidth} 
        />
        {/* Foreground Progress Circle */}
        <circle 
          cx={center} 
          cy={center} 
          r={radius} 
          fill="none" 
          stroke={strokeColor} 
          strokeWidth={strokeWidth} 
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      {/* Center Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <b className="font-display text-[28px] font-semibold leading-none text-ink">
          {value}
        </b>
        <span className="font-mono text-[8px] tracking-wider text-ink-faint mt-[3px] uppercase">
          {subLabel}
        </span>
      </div>
    </div>
  );
};
