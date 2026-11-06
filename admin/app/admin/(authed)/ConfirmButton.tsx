'use client';

// A submit button that asks window.confirm() first — used for every irreversible admin
// action (mark paid, revoke, clear UPI, enable free mode) per the spec's "confirm dialog" rule.
export function ConfirmButton({
  children, message, className,
}: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
