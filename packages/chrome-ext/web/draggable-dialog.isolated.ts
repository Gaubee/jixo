import {easy$} from "@jixo/dev/browser";

let JIXODraggableDialogElement: HTMLDialogElement | null;
export const JIXODraggableDialogIsolatedHelper = {
  async prepare() {
    return (JIXODraggableDialogElement ??= await easy$<HTMLDialogElement>(`jixo-draggable-dialog`, 0));
  },
};
