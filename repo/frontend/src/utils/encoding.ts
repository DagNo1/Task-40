const ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;"
};

export function encodeForHtml(value: string): string {
  return value.replace(/[&<>"'/]/g, (ch) => ENTITY_MAP[ch]);
}
