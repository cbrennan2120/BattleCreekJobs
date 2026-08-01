import { type MouseEvent, type ReactNode, useEffect, useRef } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  labelledBy: string;
  onClose: () => void;
  initialFocusSelector?: string;
}

export default function AccessibleDialog({ children, className = "", labelledBy, onClose, initialFocusSelector }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog) return;
    dialog.showModal();
    document.body.classList.add("modal-open");
    return () => {
      document.body.classList.remove("modal-open");
      if (dialog.open) dialog.close();
      window.setTimeout(() => opener?.focus(), 0);
    };
  }, []);

  useEffect(() => {
    const target = initialFocusSelector ? ref.current?.querySelector<HTMLElement>(initialFocusSelector) : null;
    requestAnimationFrame(() => target?.focus());
  }, [initialFocusSelector]);

  const dismissBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const inside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    if (!inside) onClose();
  };

  return (
    <dialog
      ref={ref}
      className={`dialog-card ${className}`.trim()}
      aria-labelledby={labelledBy}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onMouseDown={dismissBackdrop}
    >
      {children}
    </dialog>
  );
}
