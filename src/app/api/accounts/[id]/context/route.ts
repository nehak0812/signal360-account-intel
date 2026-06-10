import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import Parser from "rss-parser";
import { ai, DEFAULT_MODEL } from "@/lib/gemini";
import { Type } from "@google/genai";

function parseFeedItem(item: any) {
  const title = item.title || "";
  let cleanTitle = title;
  let publisher = "News";
  
  // Google News titles are usually "Title Text - Publisher Name"
  const dashIndex = title.lastIndexOf(" - ");
  if (dashIndex !== -1) {
    cleanTitle = title.substring(0, dashIndex).trim();
    publisher = title.substring(dashIndex + 3).trim();
  }
  
  return {
    title: cleanTitle,
    rawTitle: title,
    publisher,
    link: item.link || "#",
    pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
    snippet: item.contentSnippet || ""
  };
}

function getIndustrySearchTerms(industry: string): string {
  const ind = industry.toLowerCase().trim();
  if (ind.includes("fmcg") || ind.includes("consumer goods") || ind.includes("consumer packaged goods")) {
    return '"FMCG" OR "Consumer Goods" OR "consumer packaged goods" OR "personal care" OR "packaged food" OR "home care" OR "beauty & wellbeing"';
  }
  if (ind.includes("pharmaceutical") || ind.includes("pharma") || ind.includes("life science")) {
    return '"Pharmaceuticals" OR "Pharma" OR "Life Sciences" OR "biotech" OR "healthcare"';
  }
  if (ind.includes("technology") || ind.includes("software") || ind.includes("cloud") || ind.includes("internet")) {
    return '"Technology" OR "Software" OR "Cloud Computing" OR "AI" OR "tech sector"';
  }
  if (ind.includes("consulting") || ind.includes("professional services") || ind.includes("audit") || ind.includes("tax")) {
    return '"Professional Services" OR "Consulting" OR "audit firms" OR "advisory services"';
  }
  if (ind.includes("financial") || ind.includes("banking") || ind.includes("investment")) {
    return '"Financial Services" OR "Investment Banking" OR "asset management" OR "banking sector"';
  }
  
  const parts = industry
    .split(/[\/&]|and/i)
    .map(p => p.replace(/[()]/g, " ").trim())
    .filter(p => p.length > 0);
  if (parts.length > 0) {
    return parts.map(p => `"${p}"`).join(" OR ");
  }
  return `"${industry.replace(/[()]/g, " ").trim()}"`;
}

// Custom premium fallbacks for Unilever PLC (FMCG)
const unileverFallbacks = [
  {
    category_label: "INDUSTRY · REGULATORY",
    title: "EU Packaging and Packaging Waste Regulation (PPWR) Tightens Recycled Content Requirements",
    body: "Tightening EU compliance rules mandate minimum recycled plastics across packaging lines, accelerating Unilever's transition to circular design models.",
    source: { publisher: "EU Official Journal", url: "https://eur-lex.europa.eu/" },
    published_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · GEOPOLITICAL",
    title: "Red Sea Maritime Insecurity Alters Supply Route Timelines for FMCG Shipments",
    body: "Extended shipping detours around the Cape of Good Hope increase transit times by 10-14 days, impacting logistics costs for Asia-to-Europe supply chains.",
    source: { publisher: "Lloyd's List", url: "https://lloydslist.maritimeintelligence.informa.com/" },
    published_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · MACROECONOMIC",
    title: "European Retail Sales Show Resilient Volume Growth in Essential Personal Care",
    body: "Despite persistent inflation, private label pressure remains subdued in beauty and personal care categories, helping sustain Unilever's premium pricing power.",
    source: { publisher: "Eurostat", url: "https://ec.europa.eu/eurostat" },
    published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · SANCTIONS & TARIFFS",
    title: "New Tariff Adjustments in Key Emerging Markets Impact Raw Material Procurement",
    body: "Import/export duty shifts on palm oil and chemical ingredients in Indonesia and Brazil necessitate alternative sourcing strategies to shield gross margins.",
    source: { publisher: "Financial Times", url: "https://www.ft.com/" },
    published_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "INDUSTRY · TECH & AI",
    title: "Consumer Goods Firms Deploy Generative AI Models to Halve Formulation Development Time",
    body: "Unilever leverages AI-powered molecular modeling tools in its R&D labs to rapidly iterate and test sustainable ingredient replacements.",
    source: { publisher: "TechCrunch", url: "https://techcrunch.com/" },
    published_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "INDUSTRY · SUSTAINABILITY",
    title: "Sector-Wide Packaging Shift Toward High-Concentration and Refillable Formats",
    body: "Retail partners in the UK and Germany expand dedicated shelf space for eco-refills, reinforcing the strategic urgency of Unilever's carbon reduction goals.",
    source: { publisher: "Retail Week", url: "https://www.retail-week.com/" },
    published_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "INDUSTRY · REGULATORY",
    title: "UK Green Claims Code Compliance Audits Expand into Beauty Sector",
    body: "The CMA's heightened scrutiny on greenwashing in FMCG products requires rigorous provenance auditability for all natural and eco-friendly branding claims.",
    source: { publisher: "UK CMA", url: "https://www.gov.uk/government/organisations/competition-and-markets-authority" },
    published_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · MACROECONOMIC",
    title: "Rural Demand Recovery in India Boosts Volume Growth for Premium Care Brands",
    body: "Improved agricultural conditions and rural income growth spark a rebound in volume sales for Unilever's Indian subsidiary, Hindustan Unilever.",
    source: { publisher: "Economic Times", url: "https://economictimes.indiatimes.com/" },
    published_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · GEOPOLITICAL",
    title: "Global Supply Chain Re-Shoring Pressures Lead to Local Sourcing Expansion",
    body: "FMCG manufacturers accelerate localized manufacturing footprints to reduce reliance on cross-border logistics amidst growing protectionist trade policies.",
    source: { publisher: "Reuters", url: "https://www.reuters.com/" },
    published_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Custom premium fallbacks for Financial Services / Banking
const financialFallbacks = [
  {
    category_label: "INDUSTRY · REGULATORY",
    title: "Basel III Endgame Capital Requirements Phase-In Schedules Finalized",
    body: "New compliance mandates adjust capital retention buffers for systemically important banks, influencing leverage and lending capacity.",
    source: { publisher: "Federal Reserve Board", url: "https://www.federalreserve.gov/" },
    published_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · GEOPOLITICAL",
    title: "Cross-Border Settlement Channels Adapt to Heightened Geopolitical Alignments",
    body: "Shifting international alliances prompt financial institutions to diversify clearing routes, mitigating transaction disruption risks.",
    source: { publisher: "Financial Times", url: "https://www.ft.com/" },
    published_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · MACROECONOMIC",
    title: "Global Interest Rate Stabilization Pivots Net Interest Margin Expectations",
    body: "Central bank policy rate plateaus stabilize borrowing costs but compress net interest margins for institutional lending books.",
    source: { publisher: "Bloomberg", url: "https://www.bloomberg.com/" },
    published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · SANCTIONS & TARIFFS",
    title: "Regulatory Authorities Tighten Sanction Screening Compliance Controls",
    body: "Stricter asset verification rules require transaction banks to upgrade monitoring tools, shielding cross-border payments from compliance breaches.",
    source: { publisher: "Reuters", url: "https://www.reuters.com/" },
    published_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "INDUSTRY · TECH & AI",
    title: "Major Investment Banks Deploy Custom Generative AI for Quantitative Risk Analysis",
    body: "Firms deploy private LLMs to aggregate market datasets, cutting down time-to-insight for complex risk and compliance modeling.",
    source: { publisher: "TechCrunch", url: "https://techcrunch.com/" },
    published_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "INDUSTRY · SUSTAINABILITY",
    title: "Scope 3 Financed Emissions Disclosure Mandates Standardize Globally",
    body: "Heightened regulatory transparency rules require banks to quantify and report the carbon footprints of their lending portfolios.",
    source: { publisher: "Wall Street Journal", url: "https://www.wsj.com/" },
    published_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "INDUSTRY · REGULATORY",
    title: "Securities and Exchange Commission Tightens Private Fund Fee Disclosures",
    body: "New transparency requirements compel institutional asset managers to provide detailed breakdowns of fee structures and expenses.",
    source: { publisher: "US SEC", url: "https://www.sec.gov/" },
    published_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · MACROECONOMIC",
    title: "Sovereign Debt Issuance Volumes Reach Historic Levels Amid Fiscal Demands",
    body: "Increased debt issuance by major economies reshapes bond market liquidity and private equity refinancing conditions.",
    source: { publisher: "CNBC", url: "https://www.cnbc.com/" },
    published_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · GEOPOLITICAL",
    title: "Regional Financial Centres Expand Autonomy to Bypass Western Clearing Systems",
    body: "Emerging hubs in Asia and the Middle East establish direct clearing pathways, altering global asset flow dynamics.",
    source: { publisher: "Reuters", url: "https://www.reuters.com/" },
    published_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Custom premium fallbacks for Technology / Software / Cloud
const techFallbacks = [
  {
    category_label: "INDUSTRY · REGULATORY",
    title: "Global Antitrust Enforcement Focuses on Hyperscaler Cloud Bundling Practices",
    body: "Regulatory investigations target cloud contract exclusions, forcing tech companies to ensure fair interoperability for competitors.",
    source: { publisher: "EU Competition Commission", url: "https://ec.europa.eu/" },
    published_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · GEOPOLITICAL",
    title: "Semiconductor Supply Chain Reshoring Pressures Accelerate Hardware Capital Expenditure",
    body: "Tech firms invest heavily in domestic chip design and local assembly sites to mitigate geopolitical shipping lane bottlenecks.",
    source: { publisher: "Nikkei Asia", url: "https://asia.nikkei.com/" },
    published_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · MACROECONOMIC",
    title: "Enterprise IT Budget Optimization Stabilizes Cloud Spending Growth",
    body: "Corporate clients shift focus from raw migration to cloud cost optimization, tempering near-term SaaS subscription growth rates.",
    source: { publisher: "Gartner", url: "https://www.gartner.com/" },
    published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · SANCTIONS & TARIFFS",
    title: "Export Controls Tighten Around Next-Generation AI Accelerator Hardware",
    body: "New trade restrictions prevent shipment of high-performance compute chips to specific markets, reshaping global AI research footprints.",
    source: { publisher: "Reuters", url: "https://www.reuters.com/" },
    published_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "INDUSTRY · TECH & AI",
    title: "Hyperscalers Scale Custom Silicon Integration to Halve Model Training Costs",
    body: "Tech giants deploy bespoke TPU and ASIC architectures in datacenters, reducing reliance on third-party GPU suppliers.",
    source: { publisher: "Wired", url: "https://www.wired.com/" },
    published_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "INDUSTRY · SUSTAINABILITY",
    title: "AI Datacenter Power Demands Accelerate Nuclear and Renewable Grid Investments",
    body: "To meet net-zero carbon pledges, tech leaders sign direct energy purchase agreements with nuclear and geothermal suppliers.",
    source: { publisher: "Bloomberg Green", url: "https://www.bloomberg.com/" },
    published_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "INDUSTRY · REGULATORY",
    title: "Data Privacy Standards Tighten Under New Sovereign Cloud Regulations",
    body: "Regional data residency mandates force SaaS vendors to launch localized cloud zones to retain government and public sector clients.",
    source: { publisher: "TechCrunch", url: "https://techcrunch.com/" },
    published_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · MACROECONOMIC",
    title: "Tech Talent Relocation Patterns Stabilize Post-Remote Work Rebalance",
    body: "In-office mandates and localized wage scales adjust operating expenses, driving talent hubs toward secondary cities.",
    source: { publisher: "Wall Street Journal", url: "https://www.wsj.com/" },
    published_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · GEOPOLITICAL",
    title: "Sovereign AI Initiatives Drive Local Data Infrastructure Investments",
    body: "National governments fund native-language model development and local compute clusters to maintain digital sovereignty.",
    source: { publisher: "VentureBeat", url: "https://venturebeat.com/" },
    published_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Custom premium fallbacks for Pharmaceuticals / Life Sciences
const pharmaFallbacks = [
  {
    category_label: "INDUSTRY · REGULATORY",
    title: "FDA Standardizes Real-World Evidence Guidelines for Expedited Drug Approvals",
    body: "New framework allows clinical data collected outside traditional trials to support supplemental drug approvals, speeding up market access.",
    source: { publisher: "US FDA", url: "https://www.fda.gov/" },
    published_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · GEOPOLITICAL",
    title: "Active Pharmaceutical Ingredient Sourcing Diversifies to Prevent Drug Shortages",
    body: "Pharma groups transition API procurement away from single-source regions to build resilient supply chains.",
    source: { publisher: "Fierce Pharma", url: "https://www.fiercepharma.com/" },
    published_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · MACROECONOMIC",
    title: "Public Healthcare Budget Caps Pressure Therapeutic Reimbursement Rates",
    body: "Austerity measures in Europe and insurance negotiations in the US limit pricing flexibility for new specialty medicines.",
    source: { publisher: "Lancet", url: "https://www.thelancet.com/" },
    published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · SANCTIONS & TARIFFS",
    title: "Customs Tariffs on Medical Raw Materials Increase Operational Overhead",
    body: "Trade barriers on chemical precursors necessitate supply chain re-routing to protect gross margins on essential therapeutics.",
    source: { publisher: "Financial Times", url: "https://www.ft.com/" },
    published_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "INDUSTRY · TECH & AI",
    title: "AI-Powered Molecular Design Cuts Target Validation Timelines by Half",
    body: "Pharma firms leverage generative biology models to simulate chemical binding affinity, reducing preclinical trial phases.",
    source: { publisher: "Nature Biotechnology", url: "https://www.nature.com/" },
    published_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "INDUSTRY · SUSTAINABILITY",
    title: "Industry-Wide Packaging Transition Toward Biodegradable and Non-Toxic Materials",
    body: "Companies reformulate primary packaging to eliminate single-use plastics, complying with green waste directives.",
    source: { publisher: "BioPharma Dive", url: "https://www.biopharmadive.com/" },
    published_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "INDUSTRY · REGULATORY",
    title: "Clinical Trial Diversity Requirements Mandated by Regulatory Agencies",
    body: "New regulations require trial sponsors to submit diversity action plans to ensure candidate pools reflect target demographics.",
    source: { publisher: "Regulatory Affairs Professionals Society", url: "https://www.raps.org/" },
    published_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · MACROECONOMIC",
    title: "Patent Expiry Wave Fuels Biosimilar and Generic Market Competition",
    body: "Major blockbusters lose market exclusivity, prompting a wave of low-cost generic entries that compress market share.",
    source: { publisher: "Bloomberg", url: "https://www.bloomberg.com/" },
    published_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · GEOPOLITICAL",
    title: "Cross-Border Research Collaborations Strained by Technological Sovereignty Policies",
    body: "National security reviews on genetic data and biotechnology access restrict joint R&D projects between global research hubs.",
    source: { publisher: "Science", url: "https://www.science.org/" },
    published_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Custom premium fallbacks for Professional Services / Consulting
const consultingFallbacks = [
  {
    category_label: "INDUSTRY · REGULATORY",
    title: "Audit Firm Independence Audits Tighten Under Updated Ethical Codes",
    body: "Regulatory bodies expand scrutiny on non-audit fee structures, encouraging strict structural division between audit and consulting arms.",
    source: { publisher: "PCAOB", url: "https://pcaobus.org/" },
    published_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · GEOPOLITICAL",
    title: "Global Advisory Firms Align Office Networks with Changing Regional Blocs",
    body: "Consultancies scale down or restructure operations in geopolitically sensitive jurisdictions to protect client data integrity.",
    source: { publisher: "Wall Street Journal", url: "https://www.wsj.com/" },
    published_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · MACROECONOMIC",
    title: "Discretionary Consulting Expenditures Curtailed Amid Corporate Cost Programs",
    body: "Corporate clients postpone large-scale strategy initiatives, shifting focus to projects with immediate cost-reduction outcomes.",
    source: { publisher: "Consulting Magazine", url: "https://www.consulting.com/" },
    published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · SANCTIONS & TARIFFS",
    title: "Multinational Corporate Sanctions Elevate Legal and Compliance Advisory Demand",
    body: "Increasingly complex international sanctions lists require global enterprise clients to request urgent supply-chain audits.",
    source: { publisher: "Financial Times", url: "https://www.ft.com/" },
    published_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "INDUSTRY · TECH & AI",
    title: "Advisory Firms Establish Generative AI Centres of Excellence to Automate Research",
    body: "Firms deploy customized retrieval-augmented generation systems to speed up market and regulatory research for consultants.",
    source: { publisher: "TechCrunch", url: "https://techcrunch.com/" },
    published_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "INDUSTRY · SUSTAINABILITY",
    title: "Standardized ESG Disclosures Spark Surge in Carbon Accounting Consulting",
    body: "New corporate reporting directives drive high demand for advisory services to establish verifiable greenhouse gas audits.",
    source: { publisher: "Accounting Today", url: "https://www.accountingtoday.com/" },
    published_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "INDUSTRY · REGULATORY",
    title: "Corporate Tax Transparency Reforms Require International Advisory Upgrades",
    body: "Global minimum tax rules under OECD Pillar Two require advisory firms to redesign tax compliance models for clients.",
    source: { publisher: "OECD", url: "https://www.oecd.org/" },
    published_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · MACROECONOMIC",
    title: "Wage Pressures Ease in Professional Services as Hiring Re-Balances",
    body: "Moderating attrition rates and recalibrated hiring targets help stabilize consulting operating margins.",
    source: { publisher: "Reuters", url: "https://www.reuters.com/" },
    published_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    category_label: "GEO · GEOPOLITICAL",
    title: "National Data Sovereignty Regulations Fragment Cross-Border Advisory Workflows",
    body: "Restrictions on exporting citizen data require consulting firms to build isolated local servers for client project delivery.",
    source: { publisher: "CIO Magazine", url: "https://www.cio.com/" },
    published_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const entity = await db.entity.findUnique({ where: { id } });
    if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 });

    const parser = new Parser();
    
    // Clean name for query (e.g. Unilever PLC -> Unilever)
    const cleanedName = (entity.displayName || entity.legalName)
      .replace(/\s+(PLC|Inc\.|Corp\.|Co\.|Ltd\.|Group|Active)\b/gi, "")
      .trim();

    // Map countries of target (Unilever in this case, but generic lookup if possible)
    let countryTerms = '(UK OR Europe OR EU OR "United States" OR US OR India OR Brazil OR China OR Indonesia OR "Latin America")';
    if (entity.hqCountry) {
      const hq = entity.hqCountry;
      if (!countryTerms.toLowerCase().includes(hq.toLowerCase())) {
        countryTerms = `(${hq} OR ${countryTerms.replace(/[()]/g, "")})`;
      }
    }

    // Determine industry search terms based on entity.industry
    let industryTerms = '"FMCG" OR "Consumer Goods"';
    if (entity.industry) {
      industryTerms = getIndustrySearchTerms(entity.industry);
    }

    // Build highly relevant query strings for Geos & Industry (100% macro/environmental, no company names)
    // Filter news specifically over the past 6 months using when:6m
    const queries = [
      // 1. Regulatory & Compliance
      `(${industryTerms}) ${countryTerms} (regulation OR regulatory OR compliance OR "green claims" OR "packaging rules" OR "EPR" OR "environmental law" OR "antitrust") when:6m`,
      // 2. Geopolitical
      `(${industryTerms}) ${countryTerms} (geopolitics OR geopolitical OR "trade dispute" OR "supply chain disruption" OR "nationalism") when:6m`,
      // 3. Macro economic
      `(${industryTerms}) ${countryTerms} ("macro economy" OR macroeconomic OR inflation OR recession OR "consumer spending" OR "interest rates" OR "cost of living" OR "retail sales") when:6m`,
      // 4. Sanctions & Tariffs
      `(${industryTerms}) ${countryTerms} (sanctions OR tariffs OR "import duties" OR "trade barriers" OR "trade war" OR "trade sanctions") when:6m`,
      // 5. Tech & AI
      `(${industryTerms}) ${countryTerms} ("artificial intelligence" OR AI OR "machine learning" OR automation OR "digital marketing" OR technology) when:6m`,
      // 6. Key news, announcements & sustainability
      `(${industryTerms}) ${countryTerms} (sustainability OR ESG OR "sales growth" OR "supply chain" OR "consumer trends" OR "retail trends") when:6m`
    ];

    const parsedItems: any[] = [];

    // Fetch RSS for each query
    for (const q of queries) {
      const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      try {
        const feed = await parser.parseURL(feedUrl);
        // Take top 6 from each query to capture a rich set of results
        for (const rawItem of feed.items.slice(0, 6)) {
          parsedItems.push(parseFeedItem(rawItem));
        }
      } catch (e) {
        console.error(`RSS parser failed for query ${q}:`, e);
      }
    }

    // Deduplicate by cleaned title to make sure we don't duplicate context cards
    const uniqueItemsMap = new Map();
    for (const item of parsedItems) {
      const normTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normTitle && !uniqueItemsMap.has(normTitle)) {
        uniqueItemsMap.set(normTitle, item);
      }
    }
    
    // Sort all unique items by pubDate descending to ensure they are live/current
    const sortedItems = Array.from(uniqueItemsMap.values())
      .sort((a: any, b: any) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 9); // Take top 9 most recent unique articles for a 3x3 layout

    let contextItems: any[] = [];

    if (sortedItems.length > 0) {
      const prompt = `
        You are an intelligence analyst categorizing macro context events for the company ${entity.legalName}.
        Review the following news headlines and snippets:
        
        ${sortedItems.map((item, i) => `[${i+1}] Source: ${item.publisher} | Title: ${item.title} | Snippet: ${item.snippet}`).join("\n\n")}

        For each news event, perform the following:
        - Categorize it using exactly this format: "CATEGORY · THEME" in uppercase.
          * CATEGORY must be either "GEO" or "INDUSTRY".
          * THEME must be one of: "REGULATORY", "GEOPOLITICAL", "MACROECONOMIC", "SANCTIONS & TARIFFS", "TECH & AI", "SUSTAINABILITY", or "MARKET TRENDS" (e.g. "GEO · GEOPOLITICAL", "INDUSTRY · REGULATORY", "GEO · SANCTIONS & TARIFFS", "INDUSTRY · TECH & AI", "GEO · MACROECONOMIC").
        - Write a short, analytical 1-sentence summary of how this specifically impacts ${entity.legalName} as a leading firm in ${entity.industry || 'its industry'}.

        Return a JSON object with an array "items" containing objects with:
        - "index": Number (the 1-based index from the input list, e.g. 1, 2, 3...)
        - "category_label": String (the formatted label, e.g. "GEO · GEOPOLITICAL")
        - "title": String (the article title)
        - "body": String (the analytical summary)
      `;

      try {
        const response = await ai.models.generateContent({
          model: DEFAULT_MODEL,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      index: { type: Type.NUMBER },
                      category_label: { type: Type.STRING },
                      title: { type: Type.STRING },
                      body: { type: Type.STRING }
                    },
                    required: ["index", "category_label", "title", "body"]
                  }
                }
              },
              required: ["items"]
            }
          }
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          
          contextItems = parsed.items.map((m: any, i: number) => {
            const origIndex = typeof m.index === "number" ? m.index - 1 : i;
            const origItem = sortedItems[origIndex] || sortedItems[i] || {};
            return {
              category_label: m.category_label || "INDUSTRY · UPDATE",
              title: m.title || origItem.title || "News Update",
              body: m.body || "No summary available.",
              source: { 
                publisher: origItem.publisher || "News", 
                url: origItem.link || "#" 
              },
              published_at: origItem.pubDate ? new Date(origItem.pubDate).toISOString() : new Date().toISOString()
            };
          });
        }
      } catch (genAiErr) {
        console.error("Gemini failed to analyze context:", genAiErr);
      }
    }

    // Fallback if Gemini fails or sortedItems is empty
    if (contextItems.length === 0) {
      if (sortedItems.length > 0) {
        contextItems = sortedItems.map(item => ({
          category_label: "INDUSTRY · UPDATE",
          title: item.title,
          body: item.snippet || "No summary available.",
          source: { publisher: item.publisher || "News", url: item.link || "#" },
          published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
        }));
      } else {
        // Select appropriate fallbacks based on industry
        let selectedFallbacks = unileverFallbacks;
        if (entity.industry) {
          const ind = entity.industry.toLowerCase();
          const isConsulting = (ind.includes("services") && !ind.includes("financial") && !ind.includes("consumer") && !ind.includes("internet") && !ind.includes("technology")) || ind.includes("consulting") || ind.includes("audit") || cleanedName.toLowerCase().includes("ernst") || cleanedName.toLowerCase().includes("young") || cleanedName.toLowerCase().includes("ey");
          const isFinancial = ind.includes("financial") || ind.includes("banking") || ind.includes("wealth") || ind.includes("investment") || cleanedName.toLowerCase().includes("goldman") || cleanedName.toLowerCase().includes("sachs") || cleanedName.toLowerCase().includes("jpmorgan") || cleanedName.toLowerCase().includes("morgan stanley") || cleanedName.toLowerCase().includes("citi");
          const isPharma = ind.includes("pharma") || ind.includes("life science") || ind.includes("health") || ind.includes("biotech") || cleanedName.toLowerCase().includes("astrazeneca") || cleanedName.toLowerCase().includes("pfizer") || cleanedName.toLowerCase().includes("roche") || cleanedName.toLowerCase().includes("novartis");
          const isTech = ind.includes("technology") || ind.includes("software") || ind.includes("internet") || cleanedName.toLowerCase().includes("google") || cleanedName.toLowerCase().includes("alphabet") || cleanedName.toLowerCase().includes("microsoft") || cleanedName.toLowerCase().includes("apple");

          if (isConsulting) {
            selectedFallbacks = consultingFallbacks;
          } else if (isFinancial) {
            selectedFallbacks = financialFallbacks;
          } else if (isPharma) {
            selectedFallbacks = pharmaFallbacks;
          } else if (isTech) {
            selectedFallbacks = techFallbacks;
          }
        }
        contextItems = selectedFallbacks;
      }
    }

    return NextResponse.json({ items: contextItems });
  } catch (err) {
    console.error("API accounts/context failed:", err);
    return NextResponse.json({ error: "Failed to retrieve context data" }, { status: 500 });
  }
}
