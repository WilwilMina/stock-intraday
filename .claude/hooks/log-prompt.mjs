import { appendFileSync } from "node:fs";
import { join } from "node:path";

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const { prompt, session_id, cwd } = JSON.parse(input);
    const fence = "`".repeat(4);
    const entry = `\n## ${new Date().toISOString()} (session ${String(session_id).slice(0, 8)})\n\n${fence}\n${prompt}\n${fence}\n\n- **Why:** \n- **Kept / changed / rejected:** \n`;
    appendFileSync(join(cwd ?? process.cwd(), "PROMPT_LOG.raw.md"), entry);
  } catch {
    // never block the session because logging failed
  }
  process.exit(0); // print nothing: stdout from this hook is fed to Claude as context
});