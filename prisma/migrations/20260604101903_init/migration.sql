-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "domain" TEXT,
    "tickers" TEXT,
    "industry" TEXT,
    "hqCountry" TEXT,
    "hqCity" TEXT,
    "identifiers" TEXT,
    "isPublic" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "aboutRole" TEXT NOT NULL,
    "accountId" TEXT,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "rawExcerpt" TEXT,
    "publishedAt" DATETIME NOT NULL,
    "retrievedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sources" TEXT NOT NULL,
    "confidence" REAL,
    "embedding" TEXT,
    "dedupHash" TEXT,
    "isIllustrative" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signal_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "fullName" TEXT,
    "roleTitle" TEXT NOT NULL,
    "isCurrent" BOOLEAN,
    "changeType" TEXT,
    "changedAt" DATETIME,
    "source" TEXT,
    "isIllustrative" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Person_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadershipPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "personId" TEXT,
    "aboutRole" TEXT,
    "body" TEXT NOT NULL,
    "topics" TEXT,
    "engagement" TEXT,
    "postedAt" DATETIME,
    "source" TEXT NOT NULL,
    "isIllustrative" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "LeadershipPost_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeadershipPost_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "yoyChange" REAL,
    "source" TEXT NOT NULL,
    "filedAt" DATETIME,
    CONSTRAINT "FinancialMetric_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketQuote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "changePct" REAL NOT NULL,
    "week52Low" REAL NOT NULL,
    "week52High" REAL NOT NULL,
    "marketCap" TEXT NOT NULL,
    "pe" REAL,
    "dividendYield" REAL,
    "consensus" TEXT,
    "asOf" DATETIME NOT NULL,
    "isDelayed" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL,
    CONSTRAINT "MarketQuote_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SentimentPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "bucketStart" DATETIME NOT NULL,
    "netScore" REAL NOT NULL,
    "bySource" TEXT,
    "sampleMentions" TEXT,
    CONSTRAINT "SentimentPoint_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "strength" REAL NOT NULL,
    "signalIds" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Theme_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "momentum" INTEGER NOT NULL,
    "competitiveRank" INTEGER NOT NULL,
    "competitiveOf" INTEGER NOT NULL,
    "growthCount30d" INTEGER NOT NULL,
    "riskCount30d" INTEGER NOT NULL,
    "neutralCount30d" INTEGER NOT NULL,
    "ratioGrowthRisk" REAL NOT NULL,
    "overallStatus" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "signalId" TEXT,
    "severity" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CompetitorSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "competitorEntityId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    CONSTRAINT "CompetitorSet_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompetitorSet_competitorEntityId_fkey" FOREIGN KEY ("competitorEntityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Signal_accountId_dedupHash_key" ON "Signal"("accountId", "dedupHash");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_accountId_key" ON "Watchlist"("userId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorSet_accountId_competitorEntityId_key" ON "CompetitorSet"("accountId", "competitorEntityId");
