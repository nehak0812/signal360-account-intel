import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ padded = true, className = "", children, ...props }) => {
  return (
    <div 
      className={`bg-paper-2 border border-line rounded-[16px] shadow-sm ${padded ? "px-[22px] py-[20px]" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className = "" }) => {
  return (
    <div className={`flex items-center gap-[10px] mb-[16px] ${className}`}>
      {children}
    </div>
  );
};

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, className = "" }) => {
  return (
    <h3 className={`font-display font-semibold text-[17px] text-ink ${className}`}>
      {children}
    </h3>
  );
};
