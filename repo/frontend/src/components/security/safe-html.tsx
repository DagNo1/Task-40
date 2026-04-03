import { encodeForHtml } from "../../utils/encoding";

export function SafeHtml({ value }: { value: string }) {
  return <span dangerouslySetInnerHTML={{ __html: encodeForHtml(value) }} />;
}
