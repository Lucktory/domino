import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface DialogProps {
  readonly title: string;
  readonly children: ReactNode;
  /** full: covers the screen (results, with artwork in the lead slot). center: a small confirm box. */
  readonly variant?: "full" | "center";
  /** Escape / backdrop closes it. Omit for dialogs that must be answered. */
  readonly onDismiss?: () => void;
  readonly className?: string;
  /** Shown above the title, e.g. the artwork of a result screen. */
  readonly lead?: ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog that is honest about being modal: focus moves in (to [data-autofocus] or the first
 * control), Tab stays inside, the app behind is inert, and focus returns where it was on close.
 */
export function Dialog({ title, children, variant = "center", onDismiss, className, lead }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const panel = panelRef.current;
    const root = document.getElementById("root");
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (root !== null) root.inert = true;
    const target = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onDismiss !== undefined) {
        onDismiss();
        return;
      }
      if (event.key !== "Tab" || panel === null) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items.at(-1);
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (root !== null) root.inert = false;
      previous?.focus();
    };
  }, [onDismiss]);

  return createPortal(
    <div
      className={`dialog-backdrop dialog-${variant}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss?.();
      }}
    >
      <div ref={panelRef} className={`dialog-panel ${className ?? ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {lead}
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
