import { type ReactNode, useEffect, useRef } from "react";

export default function FormError({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => { ref.current?.focus(); }, [children]);
  return <p ref={ref} className={`form-error ${className}`.trim()} role="alert" tabIndex={-1}>{children}</p>;
}
