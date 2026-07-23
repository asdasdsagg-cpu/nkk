// Global dialog state — persists for the lifetime of the server process
// Default: ON (dialog shown to users)
export let dialogEnabled = true;

export function setDialogEnabled(val: boolean) {
  dialogEnabled = val;
}
