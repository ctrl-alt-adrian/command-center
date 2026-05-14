import { error } from "@sveltejs/kit";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { getKBEntry } from "../../../../../../pipelines/marketing/lib/kb.ts";

marked.setOptions({ gfm: true, breaks: false });

export async function load({ params }) {
  const entry = await getKBEntry(params.id);
  if (!entry) throw error(404, `KB entry not found: ${params.id}`);
  const rawHtml = await marked.parse(entry.body ?? "");
  const bodyHtml = DOMPurify.sanitize(rawHtml);
  return { entry, bodyHtml };
}
