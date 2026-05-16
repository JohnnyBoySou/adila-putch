import { Slot } from "@radix-ui/react-slot";
import { Link, type LinkComponentProps } from "@tanstack/react-router";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "motion/react";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground bg-muted-foreground/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const MotionSlot = motion.create(Slot);

const tapSpring = { type: "spring", stiffness: 400, damping: 25 } as const;

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export type ButtonProps =
  | (Omit<HTMLMotionProps<"button">, "ref"> &
      ButtonVariantProps & {
        type?: "button" | "submit" | "reset";
        asChild?: boolean;
      })
  | (Omit<LinkComponentProps<"a">, "type"> &
      ButtonVariantProps & {
        type: "link";
      });

const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (props, ref) => {
    if ("type" in props && props.type === "link") {
      const { type: _type, className, variant, size, ...linkProps } = props;
      const classes = cn(buttonVariants({ variant, size, className }));

      return <Link ref={ref as React.Ref<HTMLAnchorElement>} className={classes} {...linkProps} />;
    }

    const { asChild = false, disabled, type = "button", className, variant, size, ...rest } = props;
    const classes = cn(buttonVariants({ variant, size, className }));
    const motionProps = {
      whileTap: disabled ? undefined : { scale: 0.97 },
      whileHover: disabled ? undefined : { scale: 1.02 },
      transition: tapSpring,
    };

    if (asChild) {
      return (
        <MotionSlot
          ref={ref as React.Ref<HTMLElement>}
          className={classes}
          {...motionProps}
          {...rest}
        />
      );
    }

    return (
      <motion.button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type}
        className={classes}
        disabled={disabled}
        {...motionProps}
        {...rest}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
