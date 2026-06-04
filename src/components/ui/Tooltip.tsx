"use client";

import React, { useState, useEffect, useRef } from "react";

interface TooltipProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ title, children, className = "" }) => {
  const [show, setShow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`relative inline-grid place-items-center w-[18px] h-[18px] rounded-full border border-line bg-paper-3 text-ink-soft font-mono text-[11px] font-semibold cursor-help select-none transition-colors duration-200 hover:bg-brand hover:text-white hover:border-brand ${
        show ? "bg-brand text-white border-brand" : ""
      } ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        setShow(!show);
      }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span>i</span>
      {/* Tooltip Content */}
      <span 
        className={`absolute top-[calc(100%+11px)] -left-[6px] w-[310px] max-w-[78vw] bg-ink text-paper-2 p-[14px] p-[16px] rounded-[12px] font-body font-normal text-[12px] leading-[1.55] tracking-normal text-left shadow-lg transition-all duration-200 z-[130] pointer-events-none before:content-[""] before:absolute before:bottom-full before:left-[12px] before:w-0 before:height-0 before:border-[7px] before:border-transparent before:border-b-ink ${
          show ? "opacity-100 translate-y-0 visible pointer-events-auto" : "opacity-0 -translate-y-1 invisible"
        } sm:max-w-[310px] max-sm:fixed max-sm:left-[12px] max-sm:right-[12px] max-sm:top-auto max-sm:bottom-[16px] max-sm:w-auto max-sm:max-w-none max-sm:z-[250] max-sm:before:hidden`}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <h5 className="font-mono text-[9.5px] tracking-widest text-accent mb-[7px] uppercase font-semibold">
          {title}
        </h5>
        <div className="text-paper-2 font-body font-normal text-[12px] leading-[1.55] select-text">
          {children}
        </div>
      </span>
    </div>
  );
};
