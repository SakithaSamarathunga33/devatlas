import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  /** Called on Esc as well as from the content's own buttons; the parent unmounts the modal. */
  onClose: () => void;
  /** "form" keeps a stray backdrop click from discarding what was typed. */
  purpose?: "form" | "info";
  children: ReactNode;
}

/** A modal dialog; the parent renders it while open and unmounts it to close. */
export function Modal({ title, onClose, purpose = "info", children }: ModalProps) {
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose();
  };
  return (
    <Dialog isOpen onOpenChange={onOpenChange} width={512} padding={5} purpose={purpose}>
      <DialogHeader title={title} onOpenChange={onOpenChange} hasDivider={false} />
      {children}
    </Dialog>
  );
}
