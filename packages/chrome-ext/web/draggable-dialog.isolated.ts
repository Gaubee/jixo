import {easy$} from "@jixo/dev/browser";

let JIXODraggableDialogElement: HTMLDialogElement | null;
export const JIXODraggableDialogIsolatedHelper = {
  async prepare() {
    return (JIXODraggableDialogElement ??= await easy$<HTMLDialogElement>(`jixo-draggable-dialog`, 0));
  },
  async openDialog() {
    const dialogEle = await this.prepare();
    dialogEle.dataset.open = "true";
  },
  async closeDialog() {
    const dialogEle = await this.prepare();
    dialogEle.dataset.open = "false";
  },
  get isOpend() {
    return JIXODraggableDialogElement?.dataset.open === "true";
  },
};
