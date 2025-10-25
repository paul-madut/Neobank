"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface MeteorsProps {
  number?: number;
  className?: string;
}

export function Meteors({ number = 20, className }: MeteorsProps) {
  const meteors = new Array(number).fill(true);

  return (
    <>
      {meteors.map((_, idx) => (
        <motion.span
          key={idx}
          className={cn(
            "pointer-events-none absolute left-1/2 top-0 h-0.5 w-0.5 rotate-[215deg] animate-meteor rounded-full bg-slate-500 shadow-[0_0_0_1px_#ffffff10]",
            className,
          )}
          style={{
            top: Math.floor(Math.random() * 400 - 400) + "px",
            left: Math.floor(Math.random() * window.innerWidth) + "px",
            animationDelay: Math.random() * 0.8 + "s",
            animationDuration: Math.floor(Math.random() * 8 + 2) + "s",
          }}
        >
          <div className="pointer-events-none absolute top-1/2 h-px w-[50px] -translate-y-1/2 bg-gradient-to-r from-slate-500 to-transparent" />
        </motion.span>
      ))}
    </>
  );
}
