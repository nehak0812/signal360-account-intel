"use client";

import React, { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  // Lock body scroll when modal is open
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

  if (!isOpen) return null;

  return (
    <div 
      className="modal fixed inset-0 z-[300] flex items-center justify-center p-[10px] sm:p-[30px]"
      role="dialog"
      aria-modal="true"
    >
      {/* Scrim Overlay */}
      <div 
        className="scrim fixed inset-0 bg-ink/45 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={onClose}
      />
      {/* Modal Sheet Content */}
      <div 
        className="sheet relative bg-paper border border-line rounded-[18px] w-[680px] max-w-full max-h-[88vh] overflow-y-auto shadow-2xl z-[301] animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};
