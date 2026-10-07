"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

/** Bottom sheet used for forms and detail panels. Render inside <AnimatePresence>. */
export default function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <motion.div
      role="dialog"
      aria-label={title}
      initial={{ y: 140, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 140, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md px-3 pb-3"
    >
      <div className="max-h-[78vh] overflow-y-auto rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{title}</p>
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="px-2 text-lg leading-none text-muted">
            ×
          </button>
        </div>
        {children}
      </div>
    </motion.div>
  );
}
