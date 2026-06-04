"use client";

import React, { useEffect } from "react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  badge?: string;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  badge, 
  children 
}) => {
  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <>
      {/* Scrim Background Backdrop */}
      <div 
        className={`fixed inset-0 bg-ink/45 backdrop-blur-[2px] z-[200] transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      {/* Drawer Container */}
      <aside 
        className={`fixed top-0 right-0 h-screen w-[400px] max-w-[92vw] bg-paper z-[201] shadow-xl flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center gap-[10px] p-[20px] p-[22px] border-b border-line">
          <h3 className="font-display text-[19px] font-semibold text-ink flex-1">
            {title}
          </h3>
          {badge && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-risk-bg text-risk uppercase">
              {badge}
            </span>
          )}
          <button 
            onClick={onClose}
            className="w-[34px] h-[34px] rounded-[9px] border border-line bg-paper-2 hover:border-brand hover:text-brand cursor-pointer flex items-center justify-center text-ink transition-colors duration-150"
            aria-label="Close drawer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-[8px]">
          {children}
        </div>
      </aside>
    </>
  );
};
