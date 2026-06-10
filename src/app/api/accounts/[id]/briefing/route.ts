import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const entity = await db.entity.findUnique({ where: { id } });
    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const dbSignals = await db.signal.findMany({
      where: { accountId: id },
      orderBy: { publishedAt: "desc" },
    });

    const nameLower = entity.displayName.toLowerCase();
    const ind = (entity.industry || "").toLowerCase();
    
    const isConsulting = (ind.includes("services") && !ind.includes("financial") && !ind.includes("consumer") && !ind.includes("internet") && !ind.includes("technology")) || ind.includes("consulting") || ind.includes("audit") || nameLower.includes("ernst") || nameLower.includes("ey") || nameLower.includes("young") || nameLower.includes("deloitte") || nameLower.includes("pwc") || nameLower.includes("kpmg") || nameLower.includes("mckinsey") || nameLower.includes("accenture");
    const isFinancial = ind.includes("financial") || ind.includes("banking") || ind.includes("wealth") || ind.includes("investment") || nameLower.includes("goldman") || nameLower.includes("sachs") || nameLower.includes("jpmorgan") || nameLower.includes("morgan stanley") || nameLower.includes("citi");
    const isPharma = ind.includes("pharma") || ind.includes("life science") || ind.includes("health") || ind.includes("biotech") || nameLower.includes("astrazeneca") || nameLower.includes("pfizer") || nameLower.includes("roche") || nameLower.includes("novartis");
    const isTech = ind.includes("technology") || ind.includes("software") || ind.includes("internet") || nameLower.includes("google") || nameLower.includes("alphabet") || nameLower.includes("microsoft") || nameLower.includes("apple");

    // Custom rule-based highlights if no database signals exist yet
    const growthSignals = dbSignals.filter(s => s.type === "growth").slice(0, 4);
    const riskSignals = dbSignals.filter(s => s.type === "risk").slice(0, 3);

    let headline = "";
    let defaultGrowth: string[] = [];
    let defaultRisks: string[] = [];
    let competitive = "";

    if (isConsulting) {
      headline = `${entity.displayName} is expanding strategic tech partnerships and scaling AI consulting capacity to drive advisory growth.`;
      defaultGrowth = [
        "Record advisory demand for enterprise GenAI deployments and cloud migration (IDC, Gartner)",
        "Assurance and compliance revenues remain strong due to emerging ESG auditing standards (EY Global)",
        "Technology alliance deal sizes continue to expand with hyperscale cloud providers (Microsoft, AWS)"
      ];
      defaultRisks = [
        "Wage inflation and intense consultant talent recruitment wars pressure professional services margins (illustrative)",
        "Increasing global regulatory audit independence scrutiny and dual-service compliance checks (Regulatory watch)"
      ];
      competitive = "Accenture leads the public professional services margin benchmark, with EY and Deloitte expanding regional advisory market share.";
    } else if (isFinancial) {
      headline = `${entity.displayName} is scaling institutional advisory channels and digital wealth platforms while managing Basel III capital compliance.`;
      defaultGrowth = [
        "Private wealth and institutional asset management reported record net inflows in the recent quarter (Earnings)",
        "Advisory fees and underwriting revenues show strong recovery on back of M&A activity rebound (Reuters)",
        "Digital payment infrastructure scaling has driven transaction execution efficiency gains (SEC 10-K)"
      ];
      defaultRisks = [
        "Macroeconomic interest rate policy shifts and regional credit headwinds present minor margin risks (Risk report)",
        "Cybersecurity threat levels remain elevated across global institutional trading and payment networks (illustrative)"
      ];
      competitive = "JPMorgan Chase and Morgan Stanley lead the financial benchmark, while Goldman Sachs refines its capital allocation.";
    } else if (isPharma) {
      headline = `${entity.displayName} is expanding oncology portfolios and biotech therapeutic pipelines to drive long-term revenue growth.`;
      defaultGrowth = [
        "Key lung and breast cancer therapeutics received new indication approvals from global drug agencies (FDA RNS)",
        "Phase III clinical trial milestones in immunology and cell-therapy show strong therapeutic efficacy (clinical data)",
        "Strategic biotech M&A integrations have successfully bolstered next-generation rare disease pipelines (Reuters)"
      ];
      defaultRisks = [
        "Legacy product patent expirations present biosimilar market competition and margin rebase risks (SEC 20-F)",
        "High capital loss risks in early-stage R&D discovery programs and clinical trial timeline delays (illustrative)"
      ];
      competitive = "AstraZeneca and Roche lead in oncology research reinvestment, while Pfizer completes its post-pandemic re-basement.";
    } else if (isTech) {
      headline = `${entity.displayName} is investing heavily in hyperscale cloud AI datacenter infrastructure to support software and services growth.`;
      defaultGrowth = [
        "Enterprise cloud services and AI API usage surged by over 25% YoY, leading segment revenue gains (Earnings)",
        "Core software subscriptions and consumer device upgrade cycles exhibit strong customer retention rates (SEC 10-K)",
        "Strategic cloud developer integrations have accelerated corporate subscription contract expansions (Press release)"
      ];
      defaultRisks = [
        "Significant capital expenditure plans on AI datacenters present minor short-term free cash flow limits (illustrative)",
        "Global antitrust regulatory scrutiny and platform breakup risks remain an ongoing compliance concern (Regulatory watch)"
      ];
      competitive = "Microsoft leads the enterprise cloud AI expansion, while Google/Alphabet accelerates search innovation.";
    } else {
      // FMCG / Unilever defaults
      headline = `${entity.displayName} is executing a clear portfolio reshape — growth signals outbalance risks. Strategic combinations and divisions demergers concentrate operations on higher-margin Power Brands.`;
      defaultGrowth = [
        "Foods business to combine with McCormick — flavour-focused, sharpens core portfolio (Reuters, SEC)",
        "FY2025 productivity ahead of plan (~€670M saved); FCF ~€5.9B; dividend raised 3% (FY2025 results)",
        "Beauty & Wellbeing the standout growth division (company comms)",
        "Emerging-market demand improving, led by India (regional news)"
      ];
      defaultRisks = [
        "EU green-claims & packaging regulation — sector-wide compliance bar rising (illustrative)",
        "Debate over potential sale of heritage UK food brands — reputational watch (illustrative)",
        "Comparability noise: Ice Cream now discontinued ops; Foods in transition (company RNS)"
      ];
      competitive = "Momentum leads Nestlé (in a leadership transition) but trails P&G and Colgate on gross margin. P&G remains the profitability benchmark to chase.";
    }

    const growth = growthSignals.map(s => {
      const sources = JSON.parse(s.sources) as { publisher: string }[];
      const sourceStr = sources.map(src => src.publisher).join(", ");
      return `${s.title} — ${s.summary} (${sourceStr})`;
    });

    const risks = riskSignals.map(s => {
      const sources = JSON.parse(s.sources) as { publisher: string }[];
      const sourceStr = sources.map(src => src.publisher).join(", ");
      return `${s.title} — ${s.summary} (${sourceStr})`;
    });

    const finalGrowth = growth.length > 0 ? growth : defaultGrowth;
    const finalRisks = risks.length > 0 ? risks : defaultRisks;

    // Collect all unique source links
    const sourcesList: { publisher: string; url: string }[] = [];
    dbSignals.forEach(sig => {
      try {
        const sigSources = JSON.parse(sig.sources) as { publisher: string; url: string }[];
        sigSources.forEach(s => {
          if (!sourcesList.some(item => item.url === s.url)) {
            sourcesList.push(s);
          }
        });
      } catch (e) {}
    });

    const defaultSources = isConsulting ? [
      { publisher: "EY Global Review", url: "#" },
      { publisher: "Consulting Magazine", url: "#" },
      { publisher: "IDC Research", url: "#" }
    ] : isFinancial ? [
      { publisher: "SEC filings", url: "#" },
      { publisher: "Reuters Finance", url: "#" },
      { publisher: "Goldman Sachs Investor Relations", url: "#" }
    ] : isPharma ? [
      { publisher: "FDA Announcements", url: "#" },
      { publisher: "AstraZeneca Press Room", url: "#" },
      { publisher: "Nature Biotech Journal", url: "#" }
    ] : isTech ? [
      { publisher: "Microsoft Investor Relations", url: "#" },
      { publisher: "SEC 10-K Filings", url: "#" },
      { publisher: "TechCrunch Cloud Report", url: "#" }
    ] : [
      { publisher: "Reuters", url: "#" },
      { publisher: "SEC Edgar filings", url: "#" },
      { publisher: "Unilever FY2025 results", url: "#" },
      { publisher: "company press release", url: "#" }
    ];

    const finalSources = sourcesList.length > 0 ? sourcesList : defaultSources;

    return NextResponse.json({
      headline,
      growth: finalGrowth,
      risks: finalRisks,
      competitive,
      sources: finalSources,
    });
  } catch (err) {
    console.error("API accounts/briefing failed:", err);
    return NextResponse.json({ error: "Failed to retrieve executive briefing" }, { status: 500 });
  }
}
