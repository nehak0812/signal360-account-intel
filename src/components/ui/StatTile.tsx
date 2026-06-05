import React from "react";
import { Card } from "./Card";
import { Tooltip } from "./Tooltip";

interface StatTileProps {
  label: string;
  value: string | number;
  change?: string;
  direction?: "up" | "down" | "flat";
  className?: string;
  tooltipTitle?: string;
  tooltipContent?: React.ReactNode;
}

export const StatTile: React.FC<StatTileProps> = ({ 
  label, 
  value, 
  change, 
  direction, 
  className = "",
  tooltipTitle,
  tooltipContent
}) => {
  const directionClasses = {
    up: "text-growth",
    down: "text-risk",
    flat: "text-neutral"
  };

  const arrow = {
    up: "▲",
    down: "▼",
    flat: "●"
  };

  return (
    <Card padded={false} className={`p-[18px] md:p-[20px] flex flex-col justify-between ${className}`}>
      <div className="font-mono text-[9.5px] tracking-widest text-ink-faint uppercase flex items-center justify-between">
        <span>{label}</span>
        {tooltipTitle && tooltipContent && (
          <Tooltip title={tooltipTitle} className="ml-1 flex-shrink-0">
            {tooltipContent}
          </Tooltip>
        )}
      </div>
      <div className="font-display font-semibold text-[28px] mt-[7px] leading-none tracking-tight text-ink">
        {value}
      </div>
      {change && direction && (
        <div className={`inline-flex items-center gap-[4px] font-mono text-[11px] mt-[6px] font-medium ${directionClasses[direction]}`}>
          <span>{arrow[direction]}</span>
          <span>{change}</span>
        </div>
      )}
    </Card>
  );
};

