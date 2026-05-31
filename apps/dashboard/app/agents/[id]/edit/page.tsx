import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { splitVendors } from "@/lib/vendors";
import { readVendorLimits } from "@/lib/vendorLimits";
import { AgentForm } from "../../AgentForm";

export const dynamic = "force-dynamic";

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) notFound();

  const backHref = `/agents/${agent.id}`;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Edit agent</h1>
        <Link
          href={backHref}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Back
        </Link>
      </div>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Saving re-signs this agent&apos;s credential with the new rules. The old
        credential stops working immediately.
      </p>
      <AgentForm
        mode="edit"
        agentId={agent.id}
        backHref={backHref}
        initial={{
          name: agent.name,
          authorizedBy: agent.authorizedBy,
          dailyCap: agent.dailyCap,
          perTxLimit: agent.perTxLimit,
          approvedVendors: splitVendors(agent.approvedVendors),
          vendorLimits: readVendorLimits(agent.vendorLimits),
          expiresAt: agent.expiresAt.toISOString(),
        }}
      />
    </div>
  );
}
