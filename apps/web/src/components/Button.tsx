import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "anonymous";
type ButtonWidth = "default" | "full";

export type ButtonStyleOptions = {
  variant?: ButtonVariant;
  width?: ButtonWidth;
  pill?: boolean;
};

function joinClasses(parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function buttonStyles({
  variant = "primary",
  width = "default",
  pill = false,
}: ButtonStyleOptions = {}): string {
  return joinClasses([
    "inline-flex items-center justify-center gap-2 text-sm font-medium transition-opacity",
    pill ? "rounded-full" : "rounded-sm",
    width === "full" ? "w-full" : "",
    variant === "primary" && "bg-foreground text-background px-5 py-3",
    variant === "secondary" &&
      "bg-surface-strong text-foreground px-5 py-3",
    variant === "anonymous" && "text-foreground px-0 py-2",
    "disabled:opacity-50",
  ]);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonStyleOptions;

export function Button({
  variant = "primary",
  width = "default",
  pill = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={joinClasses([
        buttonStyles({ variant, width, pill }),
        className,
      ])}
      {...props}
    />
  );
}
