"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface MeteorsProps {
  number?: number;
  className?: string;
}

function generateMeteorStyles(count: number): Array<React.CSSProperties> {
  return Array.from({ length: count }, () => ({
    top: Math.floor(Math.random() * 400 - 400) + "px",
    left: Math.floor(Math.random() * window.innerWidth) + "px",
    animationDelay: Math.random() * 0.8 + "s",
    animationDuration: Math.floor(Math.random() * 8 + 2) + "s",
  }));
}

export function Meteors({ number = 20, className }: MeteorsProps) {
  const [meteorStyles, setMeteorStyles] = useState<Array<React.CSSProperties>>([]);

  useEffect(() => {
    // The positions depend on Math.random() and window.innerWidth, so they can
    // only be produced on the client - computing them during render would make
    // the server markup and the hydrated markup disagree. Scheduling the state
    // update on the next frame keeps it out of the effect body, so mounting
    // commits once and paints, instead of immediately cascading a second
    // synchronous render.
    const frame = requestAnimationFrame(() => {
      setMeteorStyles(generateMeteorStyles(number));
    });

    return () => cancelAnimationFrame(frame);
  }, [number]);

  return (
    <>
      {meteorStyles.map((style, idx) => (
        <motion.span
          key={idx}
          className={cn(
            "pointer-events-none absolute left-1/2 top-0 h-0.5 w-0.5 rotate-[215deg] animate-meteor rounded-full bg-slate-500 shadow-[0_0_0_1px_#ffffff10]",
            className,
          )}
          style={style}
        >
          <div className="pointer-events-none absolute top-1/2 h-px w-[50px] -translate-y-1/2 bg-gradient-to-r from-slate-500 to-transparent" />
        </motion.span>
      ))}
    </>
  );
}
