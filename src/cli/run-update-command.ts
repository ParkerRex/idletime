import { detectInstallContext, renderInstallUpdateGuidance } from "./install-context.ts";

export function runUpdateCommand(): string {
  return renderInstallUpdateGuidance(detectInstallContext());
}
