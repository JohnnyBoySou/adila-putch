import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-accent",
        reduceMotion && "animate-pulse",
        className,
      )}
      {...props}
    >
      {!reduceMotion && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/10 to-transparent"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );
}

export { Skeleton };
