import { ArrowLeft } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

type BackLinkProps = {
  to: string;
  children?: string;
};

export function BackLink({ to, children = "Back" }: BackLinkProps) {
  return (
    <Link
      to={to}
      className="text-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm"
    >
      <ArrowLeft size={16} />
      {children}
    </Link>
  );
}
