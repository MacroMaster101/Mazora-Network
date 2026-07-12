import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "gold";
type Size = "md" | "sm";

const variants: Record<Variant, string> = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  gold: "btn-gold",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

type ButtonAsButton = CommonProps & Omit<ComponentPropsWithoutRef<"button">, "className" | "children"> & { href?: undefined };
type ButtonAsLink = CommonProps & { href: string; external?: boolean } & Omit<ComponentPropsWithoutRef<"a">, "className" | "children" | "href">;

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", size = "md", className, children } = props;
  const classes = cn("btn", variants[variant], size === "sm" && "btn-sm", className);

  if ("href" in props && props.href !== undefined) {
    const { href, external, variant: _v, size: _s, className: _c, children: _ch, ...rest } = props;
    if (external) {
      return (
        <a href={href} className={classes} target="_blank" rel="noreferrer" {...rest}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, className: _c, children: _ch, ...rest } = props as ButtonAsButton;
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
