import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding initial database...");

  // 1. Create Unilever PLC (Target Entity)
  const unilever = await prisma.entity.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      legalName: "Unilever PLC",
      displayName: "Unilever PLC",
      domain: "unilever.com",
      tickers: JSON.stringify([
        { exchange: "LSE", symbol: "ULVR" },
        { exchange: "NYSE", symbol: "UL" }
      ]),
      industry: "Consumer Goods (FMCG)",
      hqCountry: "United Kingdom",
      hqCity: "London",
      identifiers: JSON.stringify({ CIK: "0000031529", companiesHouseNo: "02422874" }),
      isPublic: true,
    },
  });
  console.log("Upserted Target Entity:", unilever.displayName);

  // 2. Create Competitor Entities
  const competitors = [
    { id: "00000000-0000-0000-0000-000000000002", name: "Nestlé", domain: "nestle.com", ticker: "NESN", ex: "SIX" },
    { id: "00000000-0000-0000-0000-000000000003", name: "Procter & Gamble", domain: "pg.com", ticker: "PG", ex: "NYSE" },
    { id: "00000000-0000-0000-0000-000000000004", name: "Colgate-Palmolive", domain: "colgatepalmolive.com", ticker: "CL", ex: "NYSE" },
    { id: "00000000-0000-0000-0000-000000000005", name: "Reckitt", domain: "reckitt.com", ticker: "RKT", ex: "LSE" }
  ];

  const resolvedCompetitors = [];
  for (const comp of competitors) {
    const ent = await prisma.entity.upsert({
      where: { id: comp.id },
      update: {},
      create: {
        id: comp.id,
        legalName: comp.name,
        displayName: comp.name,
        domain: comp.domain,
        tickers: JSON.stringify([{ exchange: comp.ex, symbol: comp.ticker }]),
        industry: "Consumer Goods (FMCG)",
        isPublic: true,
      },
    });
    resolvedCompetitors.push(ent);
    
    // Wire competitor relationship
    await prisma.competitorSet.upsert({
      where: {
        accountId_competitorEntityId: {
          accountId: unilever.id,
          competitorEntityId: ent.id,
        }
      },
      update: {},
      create: {
        accountId: unilever.id,
        competitorEntityId: ent.id,
        rank: resolvedCompetitors.length,
        source: "agent",
      }
    });
  }
  console.log("Upserted competitor sets and entities.");

  // 3. Create Sample Signals
  const sampleSignals = [
    {
      id: "11111111-0000-0000-0000-000000000001",
      entityId: unilever.id,
      aboutRole: "target",
      category: "regulatory",
      type: "risk",
      severity: 3,
      title: "EU packaging & green-claims rules raise the compliance bar across FMCG",
      summary: "Tighter substantiation requirements for environmental marketing; sector-wide exposure given the brand portfolio.",
      rawExcerpt: "Tighter substantiation requirements for environmental marketing — sector-wide, but Unilever's brand portfolio is heavily exposed.",
      publishedAt: new Date("2026-06-02T08:00:00Z"),
      sources: JSON.stringify([{ publisher: "trade press", url: "https://www.packaginglaw.com/" }]),
      dedupHash: "hash-001",
      isIllustrative: true,
    },
    {
      id: "11111111-0000-0000-0000-000000000002",
      entityId: unilever.id,
      aboutRole: "target",
      category: "ai_pivot",
      type: "growth",
      severity: 3,
      title: "Scaling AI across R&D and marketing — formulation and content at speed",
      summary: "Use of AI/digital tools to accelerate product development and personalise marketing across power brands.",
      rawExcerpt: "Scaling AI across R&D and marketing — formulation and content at speed.",
      publishedAt: new Date("2026-06-01T08:00:00Z"),
      sources: JSON.stringify([{ publisher: "company comms", url: "https://www.unilever.com/news/press-releases/" }]),
      dedupHash: "hash-002",
      isIllustrative: true,
    },
    {
      id: "11111111-0000-0000-0000-000000000009",
      entityId: unilever.id,
      aboutRole: "target",
      category: "ma",
      type: "growth",
      severity: 5,
      title: "Unilever to combine its Foods business with McCormick",
      summary: "Brings Knorr and Hellmann's into a flavour-focused combination; sharpens Unilever toward Beauty, Personal & Home Care.",
      rawExcerpt: "Brings Knorr and Hellmann's into a flavour-focused combination; further sharpens Unilever toward Beauty, Personal & Home Care.",
      publishedAt: new Date("2026-03-31T08:00:00Z"),
      sources: JSON.stringify([
        { publisher: "Reuters", url: "https://www.reuters.com/markets/deals/" },
        { publisher: "SEC (Form 425)", url: "https://www.sec.gov/edgar/browse/?CIK=0000031529" }
      ]),
      dedupHash: "hash-009",
      isIllustrative: true,
    },
    {
      id: "11111111-0000-0000-0000-000000000010",
      entityId: unilever.id,
      aboutRole: "target",
      category: "earnings",
      type: "growth",
      severity: 4,
      title: "FY2025 results: productivity ahead of plan, dividend raised 3%",
      summary: "~EUR670M cumulative savings by year-end; free cash flow ~EUR5.9B at 100% cash conversion; underlying sales growth improved through the year.",
      rawExcerpt: "Cumulative savings of ~€670M by year-end; free cash flow ~€5.9B with 100% cash conversion.",
      publishedAt: new Date("2026-02-12T08:00:00Z"),
      sources: JSON.stringify([{ publisher: "Unilever FY2025 results", url: "https://www.unilever.com/investor-relations/" }]),
      dedupHash: "hash-010",
      isIllustrative: true,
    },
    {
      id: "11111111-0000-0000-0000-000000000011",
      entityId: unilever.id,
      aboutRole: "target",
      category: "restructure",
      type: "neutral",
      severity: 4,
      title: "Ice Cream demerger completed — The Magnum Ice Cream Company lists",
      summary: "TMICC (Magnum, Ben & Jerry's, Cornetto, Wall's) began trading Dec 2025; Unilever retains ~19.9%. Reported as discontinued operations.",
      rawExcerpt: "TMICC began trading in Amsterdam, London and New York (Dec 2025); Unilever retains a ~19.9% stake to be sold down over time.",
      publishedAt: new Date("2025-12-08T08:00:00Z"),
      sources: JSON.stringify([{ publisher: "company RNS", url: "https://www.unilever.com/news/press-releases/2024/unilever-to-accelerate-growth-action-plan-through-separation-of-ice-cream-and-launch-of-productivity-programme/" }]),
      dedupHash: "hash-011",
      isIllustrative: true,
    },
    {
      id: "11111111-0000-0000-0000-000000000006",
      entityId: "00000000-0000-0000-0000-000000000002", // Nestlé
      aboutRole: "competitor",
      category: "leadership",
      type: "risk",
      severity: 3,
      title: "Competitor Nestlé working through a leadership transition",
      summary: "Management change at a key food rival introduces near-term uncertainty into the competitive set.",
      rawExcerpt: "Rival Nestlé working through a CEO transition; competitive-set uncertainty.",
      publishedAt: new Date("2026-05-14T08:00:00Z"),
      sources: JSON.stringify([{ publisher: "financial press", url: "https://www.ft.com/companies/food-beverage" }]),
      dedupHash: "hash-006",
      isIllustrative: true,
    }
  ];

  for (const sig of sampleSignals) {
    await prisma.signal.upsert({
      where: { id: sig.id },
      update: {},
      create: {
        id: sig.id,
        entityId: sig.entityId,
        aboutRole: sig.aboutRole,
        accountId: unilever.id,
        category: sig.category,
        type: sig.type,
        severity: sig.severity,
        title: sig.title,
        summary: sig.summary,
        rawExcerpt: sig.rawExcerpt,
        publishedAt: sig.publishedAt,
        sources: sig.sources,
        dedupHash: sig.dedupHash,
        isIllustrative: sig.isIllustrative,
      },
    });
  }

  // 4. Create Market Quote
  await prisma.marketQuote.upsert({
    where: { id: "22222222-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "22222222-0000-0000-0000-000000000001",
      entityId: unilever.id,
      ticker: "ULVR",
      price: 4850,
      currency: "GBp",
      changePct: 0.9,
      week52Low: 4180,
      week52High: 5120,
      marketCap: "£115B",
      pe: 19,
      dividendYield: 3.4,
      consensus: JSON.stringify({ buy: 11, hold: 6, sell: 1, rating: "Buy" }),
      asOf: new Date(),
      source: JSON.stringify({ publisher: "Twelve Data (delayed)", url: "https://twelvedata.com" }),
    }
  });

  // 5. Create basic watchlist entry
  await prisma.watchlist.upsert({
    where: { userId_accountId: { userId: "default-user", accountId: unilever.id } },
    update: {},
    create: {
      userId: "default-user",
      accountId: unilever.id,
    }
  });

  // 5.5 Create Financial Metrics for Unilever (filings-sourced data)
  console.log("Seeding Financial Metrics for Unilever...");
  await prisma.financialMetric.deleteMany({ where: { entityId: unilever.id } });
  const metrics = [
    {
      period: "FY2025",
      metric: "turnover",
      value: 59600000000.0,
      unit: "EUR",
      yoyChange: 0.015,
      source: JSON.stringify({ publisher: "Unilever FY2025 SEC 20-F", url: "https://www.unilever.com/investor-relations/", page: "Page 42" }),
      filedAt: new Date("2026-02-12T08:00:00Z"),
    },
    {
      period: "FY2025",
      metric: "operating_margin",
      value: 0.168,
      unit: "%",
      yoyChange: 0.003,
      source: JSON.stringify({ publisher: "Unilever FY2025 SEC 20-F", url: "https://www.unilever.com/investor-relations/", page: "Page 43" }),
      filedAt: new Date("2026-02-12T08:00:00Z"),
    },
    {
      period: "FY2025",
      metric: "free_cash_flow",
      value: 5900000000.0,
      unit: "EUR",
      yoyChange: 0.08,
      source: JSON.stringify({ publisher: "Unilever FY2025 SEC 20-F", url: "https://www.unilever.com/investor-relations/", page: "Page 45" }),
      filedAt: new Date("2026-02-12T08:00:00Z"),
    },
    {
      period: "FY2025",
      metric: "dividend",
      value: 0.034,
      unit: "%",
      yoyChange: 0.03,
      source: JSON.stringify({ publisher: "Unilever FY2025 SEC 20-F", url: "https://www.unilever.com/investor-relations/", page: "Page 48" }),
      filedAt: new Date("2026-02-12T08:00:00Z"),
    },
    {
      period: "FY2025",
      metric: "gross_margin",
      value: 0.42,
      unit: "%",
      source: JSON.stringify({ publisher: "Unilever FY2025 SEC 20-F", url: "https://www.unilever.com/investor-relations/", page: "Page 42" }),
      filedAt: new Date("2026-02-12T08:00:00Z"),
    },
    {
      period: "FY2025",
      metric: "roic",
      value: 0.254,
      unit: "%",
      source: JSON.stringify({ publisher: "Unilever FY2025 SEC 20-F", url: "https://www.unilever.com/investor-relations/", page: "Page 50" }),
      filedAt: new Date("2026-02-12T08:00:00Z"),
    },
    {
      period: "FY2025",
      metric: "net_debt",
      value: 120.0,
      unit: "%",
      source: JSON.stringify({ publisher: "Unilever FY2025 SEC 20-F", url: "https://www.unilever.com/investor-relations/", page: "Page 52" }),
      filedAt: new Date("2026-02-12T08:00:00Z"),
    }
  ];

  for (const m of metrics) {
    await prisma.financialMetric.create({
      data: {
        entityId: unilever.id,
        period: m.period,
        metric: m.metric,
        value: m.value,
        unit: m.unit,
        yoyChange: m.yoyChange,
        source: m.source,
        filedAt: m.filedAt,
      }
    });
  }

  // 6. Create computed scores row
  await prisma.score.create({
    data: {
      accountId: unilever.id,
      momentum: 70,
      competitiveRank: 2,
      competitiveOf: 5,
      growthCount30d: 19,
      riskCount30d: 9,
      neutralCount30d: 10,
      ratioGrowthRisk: 2.1,
      overallStatus: "net_positive",
    }
  });

  console.log("Seeding complete successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
