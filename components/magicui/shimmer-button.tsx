"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ShimmerButtonProps {
  children: ReactNode;
  className?: string;
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  onClick?: () => void;
}

export function ShimmerButton({
  children,
  className,
  shimmerColor = "#ffffff",
  shimmerSize = "0.1em",
  borderRadius = "100px",
  shimmerDuration = "2s",
  background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  onClick,
}: ShimmerButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={
        {
          "--shimmer-color": shimmerColor,
          "--shimmer-size": shimmerSize,
          "--border-radius": borderRadius,
          "--shimmer-duration": shimmerDuration,
          "--background": background,
        } as React.CSSProperties
      }
      className={cn(
        "group relative inline-flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap px-6 py-3 text-white transition-all duration-300 [background:var(--background)] [border-radius:var(--border-radius)]",
        "transform-gpu",
        className,
      )}
      onClick={onClick}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 translate-x-[-100%] animate-[shimmer_var(--shimmer-duration)_infinite] bg-gradient-to-r from-transparent via-[var(--shimmer-color)] to-transparent opacity-50" />
      </div>
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.button>
  );
}
