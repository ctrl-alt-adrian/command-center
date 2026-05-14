import { bootstrapPipelines } from "../../core/lib/registry-bootstrap.ts";

bootstrapPipelines();

export async function handle({ event, resolve }) {
  return resolve(event);
}
