export function isTypingInField(): boolean {
  const el = document.activeElement
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === "INPUT" || tag === "TEXTAREA") return true
  if (el.isContentEditable) return true
  return false
}
