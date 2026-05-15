import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

const MotionCheckboxRoot = motion.create(CheckboxPrimitive.Root);

const popSpring = { type: "spring", stiffness: 500, damping: 28 } as const;

type CheckboxProps = Omit<
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
  "onAnimationStart" | "onAnimationEnd" | "onDrag" | "onDragStart" | "onDragEnd"
>;

const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, ...props }, ref) => (
  <MotionCheckboxRoot
    ref={ref}
    whileTap={props.disabled ? undefined : { scale: 0.88 }}
    transition={popSpring}
    className={cn(
      "peer flex size-3.5 shrink-0 items-center justify-center border border-border bg-background transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background data-[state=indeterminate]:border-foreground data-[state=indeterminate]:bg-foreground data-[state=indeterminate]:text-background",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center">
      <motion.span
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={popSpring}
        className="flex items-center justify-center"
      >
        {props.checked === "indeterminate" ? (
          <Minus className="size-2.5" strokeWidth={3} />
        ) : (
          <Check className="size-2.5" strokeWidth={3} />
        )}
      </motion.span>
    </CheckboxPrimitive.Indicator>
  </MotionCheckboxRoot>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
