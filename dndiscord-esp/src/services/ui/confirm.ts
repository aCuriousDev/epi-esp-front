/**
 * Discord Activities are sandboxed iframes that may not allow modal dialogs.
 * In that case, window.confirm() is ignored and returns undefined-ish behavior.
 *
 * We fallback to an auto-accept (true) to keep flows unblocked in Activity context.
 * For destructive actions, consider replacing with an in-app modal.
 */
export function safeConfirm(message: string): boolean {
  try {
    // When embedded in an iframe (Discord Activity), confirm() can be blocked by sandbox.
    const inIframe = typeof window !== "undefined" && window !== window.top;
    if (inIframe) {
      console.warn(
        "[ui] confirm() blocked in sandboxed iframe. Auto-accepting:",
        message,
      );
      return true;
    }
    return window.confirm(message);
  } catch {
    // Very defensive: if anything goes wrong, don't crash.
    return true;
  }
}
