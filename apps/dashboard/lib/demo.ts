/**
 * Read-only demo mode.
 *
 * When NEXT_PUBLIC_DEMO_MODE is "true", the dashboard runs as a public,
 * browsable demo: every write endpoint rejects with 403 and the UI hides or
 * disables its editing controls. Self-hosters leave it unset to get full
 * read/write functionality.
 *
 * NEXT_PUBLIC_ variables are inlined for both the server (where the 403 guard
 * is the real protection) and the client (where we hide buttons for clarity),
 * so a single env var covers both sides.
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export const DEMO_MESSAGE =
  "This is a public, read-only demo — editing is disabled here. Self-host AgentVault to make changes.";
