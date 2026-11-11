import { useEffect, useId, useRef, type ReactNode } from "react";

interface ModalProps {
  title: string;
  /** Called on Esc as well as from the content's own buttons; the parent unmounts the modal. */
  onClose: () => void;
  children: ReactNode;
}

/** A modal on the native `<dialog>`, which brings the focus trap, Esc and inert background. */
export function Modal({ title, onClose, children }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const opener = document.activeElement;
    if (dialog.current?.open === false) dialog.current.showModal();
    // The browser only restores focus on close(); parents close by unmounting.
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[85vh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-card p-5 text-foreground backdrop:bg-black/60"
    >
      <h2 id={titleId} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
