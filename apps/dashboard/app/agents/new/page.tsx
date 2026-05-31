import Link from "next/link";
import { AgentForm } from "../AgentForm";

export default function NewAgentPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Register an agent</h1>
        <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          ← Back
        </Link>
      </div>
      <AgentForm mode="create" backHref="/" />
    </div>
  );
}
