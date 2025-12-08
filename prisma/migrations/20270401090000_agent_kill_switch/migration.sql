-- CreateTable
CREATE TABLE "AgentKillSwitch" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "latched" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "latchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentKillSwitch_agentName_key" ON "AgentKillSwitch"("agentName");
