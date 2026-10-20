export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function errorMessage(e: unknown, fallback = 'Something went wrong.'): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
