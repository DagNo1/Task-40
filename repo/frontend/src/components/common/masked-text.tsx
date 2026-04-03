export function MaskedText({ value }: { value: string }) {
  const masked = value.length > 4 ? `${"*".repeat(value.length - 4)}${value.slice(-4)}` : "****";
  return <span>{masked}</span>;
}
