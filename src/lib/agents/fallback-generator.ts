import { ai, DEFAULT_MODEL } from "../gemini";
import { Type } from "@google/genai";

export interface MockFinancials {
  kpis: any[];
  ratios: any[];
  what_changed: any[];
}

export interface MockOfficer {
  name: string;
  title: string;
}

export async function generateMockFinancials(entityName: string): Promise<MockFinancials> {
  const nameLower = entityName.toLowerCase();
  
  const getStaticProfile = () => {
    if (nameLower.includes("unilever")) {
      return {
        kpis: [
          { metric: "turnover", label: "Turnover (FY2025)", value: "€59.6B", yoy: "▲ 1.5% YoY", sourceName: "Unilever FY2025 SEC 20-F", sourceUrl: "#" },
          { metric: "operating_margin", label: "Operating Margin", value: "16.8%", yoy: "FY2025", sourceName: "Unilever FY2025 SEC 20-F", sourceUrl: "#" },
          { metric: "free_cash_flow", label: "Free Cash Flow", value: "€5.9B", yoy: "FY2025", sourceName: "Unilever FY2025 SEC 20-F", sourceUrl: "#" },
          { metric: "dividend", label: "Dividend Yield", value: "3.4%", yoy: "FY2025", sourceName: "Unilever FY2025 SEC 20-F", sourceUrl: "#" }
        ],
        ratios: [
          { metric: "gross_margin", label: "Gross Margin", value: "42.0%", sourceName: "Unilever FY2025 SEC 20-F", sourceUrl: "#" },
          { metric: "roic", label: "Return on Equity", value: "25.4%", sourceName: "Unilever FY2025 SEC 20-F", sourceUrl: "#" },
          { metric: "net_debt", label: "Debt to Equity", value: "120.0%", sourceName: "Unilever FY2025 SEC 20-F", sourceUrl: "#" }
        ],
        what_changed: [
          { label: "Operations Restructuring", text: "Portfolio optimizations and margin focus program launched in late 2025.", dir: "flat" }
        ]
      };
    }
    
    if (nameLower.includes("nestle") || nameLower.includes("nestle")) {
      return {
        kpis: [
          { metric: "turnover", label: "Turnover (FY2025)", value: "CHF 92.5B", yoy: "▲ 0.8% YoY", sourceName: "Nestlé FY2025 Report", sourceUrl: "#" },
          { metric: "operating_margin", label: "Operating Margin", value: "17.2%", yoy: "FY2025", sourceName: "Nestlé FY2025 Report", sourceUrl: "#" },
          { metric: "free_cash_flow", label: "Free Cash Flow", value: "CHF 8.5B", yoy: "FY2025", sourceName: "Nestlé FY2025 Report", sourceUrl: "#" },
          { metric: "dividend", label: "Dividend Yield", value: "3.1%", yoy: "FY2025", sourceName: "Nestlé FY2025 Report", sourceUrl: "#" }
        ],
        ratios: [
          { metric: "gross_margin", label: "Gross Margin", value: "46.2%", sourceName: "Nestlé FY2025 Report", sourceUrl: "#" },
          { metric: "roic", label: "Return on Equity", value: "21.5%", sourceName: "Nestlé FY2025 Report", sourceUrl: "#" },
          { metric: "net_debt", label: "Debt to Equity", value: "105.0%", sourceName: "Nestlé FY2025 Report", sourceUrl: "#" }
        ],
        what_changed: [
          { label: "CEO Transition & Brand Reinvestment", text: "New leadership team restructuring regional units to focus on high-performance coffee and petcare brands.", dir: "up" }
        ]
      };
    }

    if (nameLower.includes("ernst") || nameLower.includes("ey") || nameLower.includes("young")) {
      return {
        kpis: [
          { metric: "turnover", label: "Global Revenue (FY2025)", value: "$51.2B", yoy: "▲ 3.9% YoY", sourceName: "EY FY2025 Global Review", sourceUrl: "#" },
          { metric: "operating_margin", label: "Estimated Margin", value: "8.5%", yoy: "FY2025", sourceName: "EY FY2025 Global Review", sourceUrl: "#" },
          { metric: "free_cash_flow", label: "Partner Distributions", value: "$6.8B", yoy: "FY2025", sourceName: "EY FY2025 Global Review", sourceUrl: "#" },
          { metric: "dividend", label: "Equity Yield Estimate", value: "N/A", yoy: "Private Partnership", sourceName: "EY FY2025 Global Review", sourceUrl: "#" }
        ],
        ratios: [
          { metric: "gross_margin", label: "Practice Margin", value: "34.0%", sourceName: "EY FY2025 Global Review", sourceUrl: "#" },
          { metric: "roic", label: "Return on Capital", value: "18.2%", sourceName: "EY FY2025 Global Review", sourceUrl: "#" },
          { metric: "net_debt", label: "Partnership Leverage", value: "15.0%", sourceName: "EY FY2025 Global Review", sourceUrl: "#" }
        ],
        what_changed: [
          { label: "AI Consulting Expansion", text: "Deploying enterprise-grade generative AI frameworks across audit, tax, and risk consulting lines to serve global clients.", dir: "up" },
          { label: "Audit Practice Evolution", text: "Strengthening independent assurance frameworks and integrating new ESG auditing parameters.", dir: "flat" }
        ]
      };
    }

    if (nameLower.includes("procter") || nameLower.includes("p&g") || nameLower.includes("pg")) {
      return {
        kpis: [
          { metric: "turnover", label: "Net Sales (FY2025)", value: "$83.8B", yoy: "▲ 2.5% YoY", sourceName: "P&G FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "operating_margin", label: "Operating Margin", value: "22.5%", yoy: "FY2025", sourceName: "P&G FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "free_cash_flow", label: "Free Cash Flow", value: "$16.2B", yoy: "FY2025", sourceName: "P&G FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "dividend", label: "Dividend Yield", value: "2.4%", yoy: "FY2025", sourceName: "P&G FY2025 Form 10-K", sourceUrl: "#" }
        ],
        ratios: [
          { metric: "gross_margin", label: "Gross Margin", value: "49.5%", sourceName: "P&G FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "roic", label: "Return on Equity", value: "32.0%", sourceName: "P&G FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "net_debt", label: "Debt to Equity", value: "72.0%", sourceName: "P&G FY2025 Form 10-K", sourceUrl: "#" }
        ],
        what_changed: [
          { label: "Premium Product Strategy", text: "Driving volume-led growth by investing heavily in product formulations and packaging innovations.", dir: "up" }
        ]
      };
    }

    if (nameLower.includes("pepsi")) {
      return {
        kpis: [
          { metric: "turnover", label: "Net Revenue (FY2025)", value: "$91.9B", yoy: "▲ 4.1% YoY", sourceName: "PepsiCo FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "operating_margin", label: "Operating Margin", value: "14.2%", yoy: "FY2025", sourceName: "PepsiCo FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "free_cash_flow", label: "Free Cash Flow", value: "$8.1B", yoy: "FY2025", sourceName: "PepsiCo FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "dividend", label: "Dividend Yield", value: "2.9%", yoy: "FY2025", sourceName: "PepsiCo FY2025 Form 10-K", sourceUrl: "#" }
        ],
        ratios: [
          { metric: "gross_margin", label: "Gross Margin", value: "54.8%", sourceName: "PepsiCo FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "roic", label: "Return on Equity", value: "50.2%", sourceName: "PepsiCo FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "net_debt", label: "Debt to Equity", value: "198.0%", sourceName: "PepsiCo FY2025 Form 10-K", sourceUrl: "#" }
        ],
        what_changed: [
          { label: "Supply Chain Rationalization", text: "Consolidating warehousing and transport routes to expand EBITDA margins under pricing pressures.", dir: "flat" }
        ]
      };
    }

    if (nameLower.includes("goldman") || nameLower.includes("sachs")) {
      return {
        kpis: [
          { metric: "turnover", label: "Net Revenues (FY2025)", value: "$51.3B", yoy: "▲ 4.5% YoY", sourceName: "Goldman Sachs FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "operating_margin", label: "Pre-tax Margin", value: "32.4%", yoy: "FY2025", sourceName: "Goldman Sachs FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "free_cash_flow", label: "Asset Management Inflow", value: "$14.2B", yoy: "FY2025", sourceName: "Goldman Sachs FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "dividend", label: "Dividend Yield", value: "2.8%", yoy: "FY2025", sourceName: "Goldman Sachs FY2025 Form 10-K", sourceUrl: "#" }
        ],
        ratios: [
          { metric: "gross_margin", label: "ROE", value: "11.2%", sourceName: "Goldman Sachs FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "roic", label: "ROTC", value: "12.8%", sourceName: "Goldman Sachs FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "net_debt", label: "Tier 1 Capital Ratio", value: "15.0%", sourceName: "Goldman Sachs FY2025 Form 10-K", sourceUrl: "#" }
        ],
        what_changed: [
          { label: "Consumer Bank Exit", text: "Successfully completed sale of consumer lending units to refocus entirely on core investment banking and asset advisory.", dir: "up" },
          { label: "Wealth Platform Scaling", text: "Net inflows in private wealth reached record levels, supported by institutional digital client platforms.", dir: "up" }
        ]
      };
    }

    if (nameLower.includes("astrazeneca") || nameLower.includes("astra zeneca")) {
      return {
        kpis: [
          { metric: "turnover", label: "Total Revenue (FY2025)", value: "$48.5B", yoy: "▲ 8.2% YoY", sourceName: "AstraZeneca FY2025 Form 20-F", sourceUrl: "#" },
          { metric: "operating_margin", label: "Operating Margin", value: "28.5%", yoy: "FY2025", sourceName: "AstraZeneca FY2025 Form 20-F", sourceUrl: "#" },
          { metric: "free_cash_flow", label: "Free Cash Flow", value: "$9.4B", yoy: "FY2025", sourceName: "AstraZeneca FY2025 Form 20-F", sourceUrl: "#" },
          { metric: "dividend", label: "Dividend Yield", value: "2.4%", yoy: "FY2025", sourceName: "AstraZeneca FY2025 Form 20-F", sourceUrl: "#" }
        ],
        ratios: [
          { metric: "gross_margin", label: "Gross Margin", value: "72.4%", sourceName: "AstraZeneca FY2025 Form 20-F", sourceUrl: "#" },
          { metric: "roic", label: "Return on Capital", value: "22.5%", sourceName: "AstraZeneca FY2025 Form 20-F", sourceUrl: "#" },
          { metric: "net_debt", label: "Debt to EBITDA", value: "1.8x", sourceName: "AstraZeneca FY2025 Form 20-F", sourceUrl: "#" }
        ],
        what_changed: [
          { label: "Oncology Pipeline Approvals", text: "New FDA approvals in lung and breast cancer therapeutics drove strong double-digit growth in oncology sales.", dir: "up" },
          { label: "Biotech Acquisitions", text: "Successfully integrated strategic acquisitions in immunological cell therapies to bolster next-gen therapeutics pipeline.", dir: "up" }
        ]
      };
    }

    if (nameLower.includes("google") || nameLower.includes("alphabet")) {
      return {
        kpis: [
          { metric: "turnover", label: "Total Revenue (FY2025)", value: "$307.4B", yoy: "▲ 15.0% YoY", sourceName: "Alphabet FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "operating_margin", label: "Operating Margin", value: "29.4%", yoy: "FY2025", sourceName: "Alphabet FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "free_cash_flow", label: "Free Cash Flow", value: "$69.5B", yoy: "FY2025", sourceName: "Alphabet FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "dividend", label: "Dividend Yield", value: "0.5%", yoy: "FY2025", sourceName: "Alphabet FY2025 Form 10-K", sourceUrl: "#" }
        ],
        ratios: [
          { metric: "gross_margin", label: "Gross Margin", value: "56.8%", sourceName: "Alphabet FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "roic", label: "Return on Equity", value: "28.5%", sourceName: "Alphabet FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "net_debt", label: "Debt to Equity", value: "12.0%", sourceName: "Alphabet FY2025 Form 10-K", sourceUrl: "#" }
        ],
        what_changed: [
          { label: "Search AI Integration", text: "Successfully rolled out AI summaries across global searches, sustaining ad CTR and query volume.", dir: "up" },
          { label: "Google Cloud Acceleration", text: "Google Cloud reached record operating profit margins as enterprise clients scaled generative AI modeling workloads.", dir: "up" }
        ]
      };
    }

    if (nameLower.includes("microsoft") || nameLower.includes("msft")) {
      return {
        kpis: [
          { metric: "turnover", label: "Total Revenue (FY2025)", value: "$245.1B", yoy: "▲ 18.0% YoY", sourceName: "Microsoft FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "operating_margin", label: "Operating Margin", value: "43.2%", yoy: "FY2025", sourceName: "Microsoft FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "free_cash_flow", label: "Free Cash Flow", value: "$59.8B", yoy: "FY2025", sourceName: "Microsoft FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "dividend", label: "Dividend Yield", value: "0.8%", yoy: "FY2025", sourceName: "Microsoft FY2025 Form 10-K", sourceUrl: "#" }
        ],
        ratios: [
          { metric: "gross_margin", label: "Gross Margin", value: "69.1%", sourceName: "Microsoft FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "roic", label: "Return on Equity", value: "38.5%", sourceName: "Microsoft FY2025 Form 10-K", sourceUrl: "#" },
          { metric: "net_debt", label: "Debt to Equity", value: "35.0%", sourceName: "Microsoft FY2025 Form 10-K", sourceUrl: "#" }
        ],
        what_changed: [
          { label: "Azure Cloud AI Scale", text: "Enterprise adoption of commercial Copilot subscriptions and Azure AI APIs drove rapid expansion in recurring revenues.", dir: "up" },
          { label: "Gaming Segment Integration", text: "Completed structural alignment of Activision Blizzard franchises, contributing to strong consumer segment margins.", dir: "up" }
        ]
      };
    }

    const cleanName = entityName.charAt(0).toUpperCase() + entityName.slice(1);
    return {
      kpis: [
        { metric: "turnover", label: "Turnover (Est. FY2025)", value: "$12.5B", yoy: "▲ 2.0% YoY", sourceName: `${cleanName} Estimates`, sourceUrl: "#" },
        { metric: "operating_margin", label: "Operating Margin", value: "12.0%", yoy: "FY2025", sourceName: `${cleanName} Estimates`, sourceUrl: "#" },
        { metric: "free_cash_flow", label: "Free Cash Flow", value: "$1.1B", yoy: "FY2025", sourceName: `${cleanName} Estimates`, sourceUrl: "#" },
        { metric: "dividend", label: "Dividend Yield", value: "1.8%", yoy: "FY2025", sourceName: `${cleanName} Estimates`, sourceUrl: "#" }
      ],
      ratios: [
        { metric: "gross_margin", label: "Gross Margin", value: "38.0%", sourceName: `${cleanName} Estimates`, sourceUrl: "#" },
        { metric: "roic", label: "Return on Equity", value: "15.0%", sourceName: `${cleanName} Estimates`, sourceUrl: "#" },
        { metric: "net_debt", label: "Debt to Equity", value: "65.0%", sourceName: `${cleanName} Estimates`, sourceUrl: "#" }
      ],
      what_changed: [
        { label: "Operational Alignment", text: "Standardizing corporate administrative units to enhance overall productivity.", dir: "flat" }
      ]
    };
  };

  if (!process.env.GEMINI_API_KEY) {
    return getStaticProfile();
  }

  const prompt = `
    You are a corporate finance AI agent. Generate highly realistic, representative estimated financial metrics and key segment structural changes for the company "${entityName}" for the fiscal year 2025.
    If "${entityName}" is a real public company (such as Nestlé, Procter & Gamble, Colgate-Palmolive, Reckitt, PepsiCo, Apple, Microsoft, etc.), use your training data to estimate realistic values that align closely with their actual FY2025 reported results (e.g. revenue scale, margin percentage, dividend yield).
    If it is a private, custom, or fictional company, estimate metrics that are realistic for their scale.
    
    Ensure that you select the correct primary reporting currency (e.g. EUR for Nestlé/European firms, USD for US firms, GBP for British firms, CHF for Swiss firms, INR for Indian firms) and format values accordingly (e.g. "$55.4B" or "€62.1B").
    
    Return a JSON object matching this schema:
    {
      "kpis": [
        { "metric": "turnover", "label": "Turnover (FY2025)", "value": "String (e.g. €62.1B)", "yoy": "String (e.g. ▲ 2.1% YoY)", "sourceName": "Estimated FY2025 Profile", "sourceUrl": "#" },
        { "metric": "operating_margin", "label": "Operating Margin", "value": "String (e.g. 15.4%)", "yoy": "FY2025", "sourceName": "Estimated FY2025 Profile", "sourceUrl": "#" },
        { "metric": "free_cash_flow", "label": "Free Cash Flow", "value": "String (e.g. €5.2B)", "yoy": "FY2025", "sourceName": "Estimated FY2025 Profile", "sourceUrl": "#" },
        { "metric": "dividend", "label": "Dividend Yield", "value": "String (e.g. 3.1%)", "yoy": "FY2025", "sourceName": "Estimated FY2025 Profile", "sourceUrl": "#" }
      ],
      "ratios": [
        { "metric": "gross_margin", "label": "Gross Margin", "value": "String (e.g. 45.2%)", "sourceName": "Estimated FY2025 Profile", "sourceUrl": "#" },
        { "metric": "roic", "label": "Return on Equity", "value": "String (e.g. 22.8%)", "sourceName": "Estimated FY2025 Profile", "sourceUrl": "#" },
        { "metric": "net_debt", "label": "Debt to Equity", "value": "String (e.g. 110.5%)", "sourceName": "Estimated FY2025 Profile", "sourceUrl": "#" }
      ],
      "what_changed": [
        { "label": "String (2-4 words, e.g. Cost Restructuring Plan)", "text": "String (1-2 sentences detailing the development)", "dir": "String (up|down|flat)" },
        { "label": "String (2-4 words, e.g. Digital Sales Growth)", "text": "String (1-2 sentences detailing the development)", "dir": "String (up|down|flat)" }
      ]
    }
    
    Do not add markdown formatting or explanations. Return ONLY the strict JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as MockFinancials;
    }
    throw new Error("Empty response");
  } catch (err) {
    console.error(`Gemini mock financials generation failed for ${entityName}:`, err);
    return getStaticProfile();
  }
}

export async function generateMockOfficers(entityName: string): Promise<MockOfficer[]> {
  const nameLower = entityName.toLowerCase();
  
  const getStaticOfficers = () => {
    if (nameLower.includes("unilever")) {
      return [
        { name: "Hein Schumacher", title: "Chief Executive Officer" },
        { name: "Fernando Fernandez", title: "Chief Financial Officer" },
        { name: "Richard Slater", title: "Chief R&D Officer" }
      ];
    }
    if (nameLower.includes("nestle") || nameLower.includes("nestle")) {
      return [
        { name: "Laurent Freixe", title: "Chief Executive Officer" },
        { name: "Anna Manz", title: "Chief Financial Officer" },
        { name: "David Rennie", title: "Head of Nestlé Coffee Brands" }
      ];
    }
    if (nameLower.includes("ernst") || nameLower.includes("ey") || nameLower.includes("young")) {
      return [
        { name: "Janet Truncale", title: "Global Chair and CEO" },
        { name: "Andy Baldwin", title: "Global Managing Partner — Client Service" },
        { name: "Jad Shimaly", title: "Global Managing Partner — Business Enablement" }
      ];
    }
    if (nameLower.includes("procter") || nameLower.includes("p&g") || nameLower.includes("pg")) {
      return [
        { name: "Jon R. Moeller", title: "Chairman of the Board, President and CEO" },
        { name: "Andre Schulten", title: "Chief Financial Officer" },
        { name: "Shailesh Jejurikar", title: "Chief Operating Officer" }
      ];
    }
    if (nameLower.includes("pepsi")) {
      return [
        { name: "Ramon Laguarta", title: "Chairman and Chief Executive Officer" },
        { name: "James Caulfield", title: "Chief Financial Officer" }
      ];
    }
    if (nameLower.includes("goldman") || nameLower.includes("sachs")) {
      return [
        { name: "David Solomon", title: "Chairman and Chief Executive Officer" },
        { name: "Denis Coleman", title: "Chief Financial Officer" },
        { name: "John Waldron", title: "President and Chief Operating Officer" }
      ];
    }
    if (nameLower.includes("astrazeneca") || nameLower.includes("astra zeneca")) {
      return [
        { name: "Pascal Soriot", title: "Executive Director and Chief Executive Officer" },
        { name: "Aradhana Sarin", title: "Executive Director and Chief Financial Officer" },
        { name: "Michel Demaré", title: "Non-Executive Chairman of the Board" }
      ];
    }
    if (nameLower.includes("google") || nameLower.includes("alphabet")) {
      return [
        { name: "Sundar Pichai", title: "Chief Executive Officer" },
        { name: "Anat Ashkenazi", title: "Chief Financial Officer" },
        { name: "Ruth Porat", title: "President & Chief Investment Officer" }
      ];
    }
    if (nameLower.includes("microsoft") || nameLower.includes("msft")) {
      return [
        { name: "Satya Nadella", title: "Chairman and Chief Executive Officer" },
        { name: "Amy Hood", title: "Executive Vice President and CFO" },
        { name: "Brad Smith", title: "Vice Chair and President" }
      ];
    }
    
    return [
      { name: "John Davis", title: "Chief Executive Officer" },
      { name: "Sarah Jenkins", title: "Chief Financial Officer" }
    ];
  };

  if (!process.env.GEMINI_API_KEY) {
    return getStaticOfficers();
  }

  const prompt = `
    Identify the real, current top 3 to 4 executive officers and board members of the company "${entityName}" (e.g. Chief Executive Officer, Chief Financial Officer, or other C-suite roles).
    If "${entityName}" is a real public company (e.g. Nestlé, Procter & Gamble, Colgate-Palmolive, Reckitt, Apple, Microsoft, etc.), use your training data to find their actual names and correct corporate titles.
    If it is a private, custom, or fictional company, generate highly realistic executive names and titles suited for their business type.
    
    Return a JSON array of objects matching this schema:
    [
      { "name": "String (full name, e.g. Mark Schneider)", "title": "String (role title, e.g. Chief Executive Officer)" }
    ]
    
    Do not add markdown formatting or explanations. Return ONLY the strict JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as MockOfficer[];
    }
    throw new Error("Empty response");
  } catch (err) {
    console.error(`Gemini mock officers generation failed for ${entityName}:`, err);
    return getStaticOfficers();
  }
}
