const ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;"
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"'/]/g, (char) => ENTITY_MAP[char]);
}
