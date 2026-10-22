interface ToastProps {
  readonly message: string;
  readonly dismissLabel: string;
  readonly onDismiss: () => void;
}

/** Short notice at the top of the screen, away from the hand and the action buttons. */
export function Toast({ message, dismissLabel, onDismiss }: ToastProps) {
  return (
    <div className="toast" role="status" aria-live="polite">
      <p>{message}</p>
      <button type="button" className="toast-close" aria-label={dismissLabel} onClick={onDismiss}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}
