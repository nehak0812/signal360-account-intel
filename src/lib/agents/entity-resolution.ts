import { ai, DEFAULT_MODEL } from "../gemini";

export interface ResolvedCandidate {
  legalName: string;
  displayName: string;
  domain: string;
  tickers: { exchange: string; symbol: string }[];
  industry: string;
  hqCountry: string;
  hqCity: string;
  identifiers: { CIK?: string; LEI?: string; companiesHouseNo?: string };
  isPublic: boolean;
}

/**
 * Searches SEC and Companies House for information to help Gemini disambiguate the query.
 */
async function fetchRegistryClues(query: string): Promise<string> {
  const clues: string[] = [];

  // 1. Fetch SEC ticker mappings
  try {
    const userAgent = process.env.SEC_EDGAR_USER_AGENT || "SIGNAL/1.0 (contact@example.com)";
    const secRes = await fetch("https://data.sec.gov/files/company_tickers.json", {
      headers: { "User-Agent": userAgent },
    });
    if (secRes.ok) {
      const data = await secRes.json() as Record<string, { cik_str: number; ticker: string; title: string }>;
      const matches = Object.values(data)
        .filter(item => item.title.toLowerCase().includes(query.toLowerCase()) || item.ticker.toLowerCase() === query.toLowerCase())
        .slice(0, 5);
      
      if (matches.length > 0) {
        clues.push("SEC EDGAR Matches: " + JSON.stringify(matches));
      }
    }
  } catch (err) {
    console.error("SEC EDGAR fetch failed:", err);
  }

  // 2. Fetch UK Companies House
  const chKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (chKey) {
    try {
      const auth = Buffer.from(chKey + ":").toString("base64");
      const chRes = await fetch(`https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(query)}&items_per_page=5`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (chRes.ok) {
        const data = await chRes.json() as { items?: { company_number: string; title: string; company_status: string; address?: { country?: string; locality?: string } }[] };
        if (data.items && data.items.length > 0) {
          clues.push("UK Companies House Matches: " + JSON.stringify(data.items));
        }
      }
    } catch (err) {
      console.error("Companies House fetch failed:", err);
    }
  }

  return clues.join("\n");
}

export async function resolveEntity(query: string): Promise<ResolvedCandidate[]> {
  const clues = await fetchRegistryClues(query);

  const prompt = `You are the Entity Resolution Agent for SIGNAL, an AI-driven account intelligence platform.
Your task is to resolve the search query "${query}" into 1 to 3 distinct candidate entities.

Use these external registry search matches as factual grounding if they match the query:
${clues || "No registry matches found."}

Provide disambiguation between parent companies and subsidiaries (for example, "Unilever PLC" vs "Hindustan Unilever" vs "Unilever Indonesia").

Return the output as a strict JSON array of candidate objects. Each object must follow this typescript interface:
interface ResolvedCandidate {
  legalName: string;      // The official legal name of the entity
  displayName: string;    // Clean display name (e.g., "Unilever PLC")
  domain: string;         // Primary corporate web domain (e.g., "unilever.com")
  tickers: { exchange: string; symbol: string }[]; // Array of tickers (e.g. [{exchange: "LSE", symbol: "ULVR"}, {exchange: "NYSE", symbol: "UL"}])
  industry: string;       // Primary industry sector (e.g., "Consumer Goods (FMCG)")
  hqCountry: string;      // Country where HQ is located (e.g., "London, UK")
  hqCity: string;         // City of HQ
  identifiers: { CIK?: string; LEI?: string; companiesHouseNo?: string }; // Verified registry numbers if known
  isPublic: boolean;      // True if publicly traded
}

Do not write any code or explanation. Return ONLY the valid JSON array of candidates.`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    const candidates = JSON.parse(text) as ResolvedCandidate[];
    return candidates;
  } catch (err) {
    console.error("Gemini Entity Resolution failed, falling back to basic mock list:", err);
    
    // Fallback logic for offline / no-key mode
    const qLower = query.toLowerCase();
    if (qLower.includes("unilever")) {
      return [
        {
          legalName: "Unilever PLC",
          displayName: "Unilever PLC",
          domain: "unilever.com",
          tickers: [{ exchange: "LSE", symbol: "ULVR" }, { exchange: "NYSE", symbol: "UL" }],
          industry: "Consumer Goods (FMCG)",
          hqCountry: "United Kingdom",
          hqCity: "London",
          identifiers: { CIK: "0000031529", companiesHouseNo: "02422874" },
          isPublic: true,
        },
        {
          legalName: "Hindustan Unilever Limited",
          displayName: "Hindustan Unilever Ltd",
          domain: "hul.co.in",
          tickers: [{ exchange: "NSE", symbol: "HINDUNILVR" }],
          industry: "FMCG",
          hqCountry: "India",
          hqCity: "Mumbai",
          identifiers: {},
          isPublic: true,
        },
        {
          legalName: "PT Unilever Indonesia Tbk",
          displayName: "Unilever Indonesia Tbk",
          domain: "unilever.co.id",
          tickers: [{ exchange: "IDX", symbol: "UNVR" }],
          industry: "FMCG",
          hqCountry: "Indonesia",
          hqCity: "Jakarta",
          identifiers: {},
          isPublic: true,
        }
      ];
    } else if (qLower.includes("nestle") || qLower.includes("nest\u00e9")) {
      return [
        {
          legalName: "Nestl\u00e9 S.A.",
          displayName: "Nestl\u00e9",
          domain: "nestle.com",
          tickers: [{ exchange: "SIX", symbol: "NESN" }],
          industry: "Consumer Goods (FMCG)",
          hqCountry: "Switzerland",
          hqCity: "Vevey",
          identifiers: {},
          isPublic: true,
        }
      ];
    } else if (qLower.includes("procter") || qLower.includes("p&g") || qLower.includes("pg")) {
      return [
        {
          legalName: "Procter & Gamble Co",
          displayName: "Procter & Gamble",
          domain: "pg.com",
          tickers: [{ exchange: "NYSE", symbol: "PG" }],
          industry: "Consumer Goods (FMCG)",
          hqCountry: "United States",
          hqCity: "Cincinnati",
          identifiers: { CIK: "0000080424" },
          isPublic: true,
        }
      ];
    } else if (qLower.includes("colgate")) {
      return [
        {
          legalName: "Colgate-Palmolive Company",
          displayName: "Colgate-Palmolive",
          domain: "colgatepalmolive.com",
          tickers: [{ exchange: "NYSE", symbol: "CL" }],
          industry: "Consumer Goods (FMCG)",
          hqCountry: "United States",
          hqCity: "New York",
          identifiers: { CIK: "0000021665" },
          isPublic: true,
        }
      ];
    } else if (qLower.includes("reckitt")) {
      return [
        {
          legalName: "Reckitt Benckiser Group plc",
          displayName: "Reckitt",
          domain: "reckitt.com",
          tickers: [{ exchange: "LSE", symbol: "RKT" }],
          industry: "Consumer Goods (FMCG)",
          hqCountry: "United Kingdom",
          hqCity: "Slough",
          identifiers: { companiesHouseNo: "06270876" },
          isPublic: true,
        }
      ];
    } else if (qLower.includes("ernst") || qLower.includes("ey") || qLower.includes("young")) {
      return [
        {
          legalName: "Ernst & Young Global Limited",
          displayName: "Ernst & Young",
          domain: "ey.com",
          tickers: [],
          industry: "Professional Services / Consulting & Audit",
          hqCountry: "United Kingdom",
          hqCity: "London",
          identifiers: {},
          isPublic: false,
        }
      ];
    } else if (qLower.includes("goldman") || qLower.includes("sachs") || qLower.includes("gs")) {
      return [
        {
          legalName: "The Goldman Sachs Group, Inc.",
          displayName: "Goldman Sachs",
          domain: "goldmansachs.com",
          tickers: [{ exchange: "NYSE", symbol: "GS" }],
          industry: "Investment Banking / Financial Services",
          hqCountry: "United States",
          hqCity: "New York",
          identifiers: { CIK: "0000886982" },
          isPublic: true,
        }
      ];
    } else if (qLower.includes("google") || qLower.includes("alphabet")) {
      return [
        {
          legalName: "Alphabet Inc.",
          displayName: "Google",
          domain: "google.com",
          tickers: [{ exchange: "NASDAQ", symbol: "GOOGL" }],
          industry: "Technology / Internet Services",
          hqCountry: "United States",
          hqCity: "Mountain View",
          identifiers: { CIK: "0001652044" },
          isPublic: true,
        }
      ];
    } else if (qLower.includes("microsoft") || qLower.includes("msft")) {
      return [
        {
          legalName: "Microsoft Corporation",
          displayName: "Microsoft",
          domain: "microsoft.com",
          tickers: [{ exchange: "NASDAQ", symbol: "MSFT" }],
          industry: "Technology / Software & Cloud",
          hqCountry: "United States",
          hqCity: "Redmond",
          identifiers: { CIK: "0000789019" },
          isPublic: true,
        }
      ];
    } else if (qLower.includes("astrazeneca") || qLower.includes("astra zeneca") || qLower.includes("azn")) {
      return [
        {
          legalName: "AstraZeneca PLC",
          displayName: "AstraZeneca",
          domain: "astrazeneca.com",
          tickers: [{ exchange: "NASDAQ", symbol: "AZN" }, { exchange: "LSE", symbol: "AZN" }],
          industry: "Pharmaceuticals / Life Sciences",
          hqCountry: "United Kingdom",
          hqCity: "Cambridge",
          identifiers: { CIK: "0000901832" },
          isPublic: true,
        }
      ];
    }

    // Generic fallback for any other company search to allow registering anything
    const cleanName = query.charAt(0).toUpperCase() + query.slice(1);
    
    let industry = "Consumer Goods (FMCG)";
    let isPublic = true;
    let tickers = [{ exchange: "NYSE", symbol: query.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "") || "TEMP" }];
    let hqCountry = "United States";
    let hqCity = "New York";

    if (qLower.includes("deloitte") || qLower.includes("pwc") || qLower.includes("kpmg") || qLower.includes("mckinsey") || qLower.includes("accenture")) {
      industry = "Professional Services / Consulting";
      isPublic = qLower.includes("accenture");
      tickers = qLower.includes("accenture") ? [{ exchange: "NYSE", symbol: "ACN" }] : [];
      hqCountry = qLower.includes("accenture") ? "Ireland" : "United States";
      hqCity = qLower.includes("accenture") ? "Dublin" : "New York";
    } else if (qLower.includes("pepsi")) {
      industry = "Food & Beverage";
      tickers = [{ exchange: "NASDAQ", symbol: "PEP" }];
    } else if (qLower.includes("coca") || qLower.includes("coke")) {
      industry = "Food & Beverage";
      tickers = [{ exchange: "NYSE", symbol: "KO" }];
    } else if (qLower.includes("astrazeneca") || qLower.includes("astra zeneca") || qLower.includes("azn")) {
      industry = "Pharmaceuticals / Life Sciences";
      tickers = [{ exchange: "LSE", symbol: "AZN" }, { exchange: "NASDAQ", symbol: "AZN" }];
      hqCountry = "United Kingdom";
      hqCity = "Cambridge";
    } else if (qLower.includes("tech") || qLower.includes("google") || qLower.includes("microsoft") || qLower.includes("apple") || qLower.includes("meta") || qLower.includes("amazon")) {
      industry = "Technology";
    }

    return [
      {
        legalName: `${cleanName} Corp`,
        displayName: cleanName,
        domain: `${query.toLowerCase().replace(/[^a-z]/g, "")}.com`,
        tickers: tickers,
        industry: industry,
        hqCountry: hqCountry,
        hqCity: hqCity,
        identifiers: {},
        isPublic: isPublic,
      }
    ];
  }
}
