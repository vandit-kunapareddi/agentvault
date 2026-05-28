-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "trustTier" TEXT NOT NULL DEFAULT 'verified',
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 85,
    "trustProviderId" TEXT,
    "parentAgentId" TEXT,
    "credential" TEXT,
    "authorizedBy" TEXT NOT NULL,
    "dailyCap" DOUBLE PRECISION NOT NULL,
    "perTxLimit" DOUBLE PRECISION NOT NULL,
    "approvedVendors" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'x402',
    "trustTier" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escalation" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Escalation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_walletAddress_key" ON "Agent"("walletAddress");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_parentAgentId_fkey" FOREIGN KEY ("parentAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

