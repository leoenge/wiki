import type { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function TextField({ label, className, id, ...props }: TextFieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="block space-y-2" htmlFor={fieldId}>
      <span className="text-sm font-medium">{label}</span>
      <input
        id={fieldId}
        className={[
          "bg-surface text-foreground w-full rounded-xs px-4 py-3 text-base outline-none placeholder:text-muted",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
    </label>
  );
}
