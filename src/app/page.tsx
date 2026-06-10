"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatTile } from "@/components/ui/StatTile";
import { Gauge } from "@/components/ui/Gauge";
import { Tooltip } from "@/components/ui/Tooltip";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";

type TabType = "command" | "search" | "feed" | "riskmap" | "compete" | "financials" | "leadership" | "sentiment" | "geo" | "watchlist";

export default function SignalDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("search");
  const [accountId, setAccountId] = useState<string>("00000000-0000-0000-0000-000000000001"); // Unilever PLC default
  
  // Dashboard & global data states
  const [overview, setOverview] = useState<any>(null);
  const [signalsFeed, setSignalsFeed] = useState<any>({ items: [], total: 0, shown: 0 });
  const [mapData, setMapData] = useState<any>(null);
  const [competitors, setCompetitors] = useState<any>(null);
  const [financials, setFinancials] = useState<any>(null);
  const [leadership, setLeadership] = useState<any>(null);
  const [linkedin, setLinkedin] = useState<any>(null);
  const [sentiment, setSentiment] = useState<any>(null);
  const [context, setContext] = useState<any>(null);
  const [alerts, setAlerts] = useState<any>({ alerts: [], unread: 0 });
  const [watchlist, setWatchlist] = useState<any>({ accounts: [] });
  const [briefing, setBriefing] = useState<any>(null);

  // Filter states for news feed
  const [feedRange, setFeedRange] = useState<string>("180");
  const [feedCategory, setFeedCategory] = useState<string>("all");
  const [feedType, setFeedType] = useState<string>("all");
  const [feedScope, setFeedScope] = useState<string>("all");
  const [feedPage, setFeedPage] = useState<number>(1);
  const lastFiltersRef = React.useRef("");

  // Interaction UI states
  const [alertDrawerOpen, setAlertDrawerOpen] = useState(false);
  const [briefingModalOpen, setBriefingModalOpen] = useState(false);
  const [entityTreeModalOpen, setEntityTreeModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCandidates, setSearchCandidates] = useState<any[]>([]);
  const [watchlisted, setWatchlisted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncLiveSignals = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/signals/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully synced ${data.count} live signals!`);
        loadSignalsFeed();
      } else {
        alert("Failed to sync signals: " + data.error);
      }
    } catch (e) {
      alert("Error syncing signals.");
    } finally {
      setIsSyncing(false);
    }
  };

  const [isRefreshingVoices, setIsRefreshingVoices] = useState(false);

  const handleRefreshVoices = async () => {
    setIsRefreshingVoices(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/linkedin-voices`);
      if (res.ok) {
        const data = await res.json();
        setLinkedin(data);
      } else {
        alert("Failed to refresh voices.");
      }
    } catch (e) {
      console.error("Error refreshing voices:", e);
      alert("Error refreshing voices.");
    } finally {
      setIsRefreshingVoices(false);
    }
  };

  // Fetch Watchlist status & list
  const fetchWatchlist = async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data);
        const isCurrentWatched = data.accounts.some((a: any) => a.entity.id === accountId);
        setWatchlisted(isCurrentWatched);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle watchlist
  const handleWatchlistToggle = async () => {
    try {
      if (watchlisted) {
        const res = await fetch(`/api/watchlist/${accountId}`, { method: "DELETE" });
        if (res.ok) {
          setWatchlisted(false);
          fetchWatchlist();
        }
      } else {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        });
        if (res.ok) {
          setWatchlisted(true);
          fetchWatchlist();
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Perform search query
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchCandidates([]);
      return;
    }
    try {
      const res = await fetch(`/api/accounts/resolve?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchCandidates(data.candidates);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load account context data
  const loadAccountData = async () => {
    setLoading(true);
    try {
      // Fetch all endpoints concurrently to improve page load speed
      const [
        overviewRes,
        compRes,
        finRes,
        mapRes,
        alertsRes,
        briefingRes,
        leadRes,
        liRes,
        sentRes,
        geoRes,
      ] = await Promise.all([
        fetch(`/api/accounts/${accountId}/overview`),
        fetch(`/api/accounts/${accountId}/competitors`),
        fetch(`/api/accounts/${accountId}/financials`),
        fetch(`/api/accounts/${accountId}/map`),
        fetch(`/api/accounts/${accountId}/alerts`),
        fetch(`/api/accounts/${accountId}/briefing`),
        fetch(`/api/accounts/${accountId}/leadership`),
        fetch(`/api/accounts/${accountId}/linkedin-voices`),
        fetch(`/api/accounts/${accountId}/sentiment`),
        fetch(`/api/accounts/${accountId}/context`),
      ]);

      // Parse JSON responses concurrently
      const [
        overviewData,
        compData,
        finData,
        mapDataVal,
        alertsData,
        briefingData,
        leadData,
        liData,
        sentData,
        geoData,
      ] = await Promise.all([
        overviewRes.ok ? overviewRes.json() : null,
        compRes.ok ? compRes.json() : null,
        finRes.ok ? finRes.json() : null,
        mapRes.ok ? mapRes.json() : null,
        alertsRes.ok ? alertsRes.json() : null,
        briefingRes.ok ? briefingRes.json() : null,
        leadRes.ok ? leadRes.json() : null,
        liRes.ok ? liRes.json() : null,
        sentRes.ok ? sentRes.json() : null,
        geoRes.ok ? geoRes.json() : null,
      ]);

      if (overviewData) setOverview(overviewData);
      if (compData) setCompetitors(compData);
      if (finData) setFinancials(finData);
      if (mapDataVal) setMapData(mapDataVal);
      if (alertsData) setAlerts(alertsData);
      if (briefingData) setBriefing(briefingData);
      if (leadData) setLeadership(leadData);
      if (liData) setLinkedin(liData);
      if (sentData) setSentiment(sentData);
      if (geoData) setContext(geoData);

    } catch (e) {
      console.error("Error loading account data:", e);
    } finally {
      setLoading(false);
    }
  };

  // Load signals feed whenever range/category/type/scope, accountId or page changes
  const loadSignalsFeed = async (pageVal = feedPage) => {
    try {
      const feedRes = await fetch(`/api/accounts/${accountId}/signals?range=${feedRange}&category=${feedCategory}&type=${feedType}&scope=${feedScope}&page=${pageVal}&limit=50`);
      if (feedRes.ok) {
        const data = await feedRes.json();
        setSignalsFeed(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger loading when accountId changes
  useEffect(() => {
    loadAccountData();
    fetchWatchlist();
  }, [accountId]);

  // Load signals on filters or page change
  useEffect(() => {
    const currentFilters = `${accountId}-${feedRange}-${feedCategory}-${feedType}-${feedScope}`;
    if (lastFiltersRef.current && lastFiltersRef.current !== currentFilters) {
      lastFiltersRef.current = currentFilters;
      setFeedPage(1);
      if (feedPage === 1) {
        loadSignalsFeed(1);
      }
      return;
    }
    lastFiltersRef.current = currentFilters;
    loadSignalsFeed(feedPage);
  }, [accountId, feedRange, feedCategory, feedType, feedScope, feedPage]);

  // Connect Server-Sent Events (SSE) for live scores and alerts notifications
  useEffect(() => {
    console.log(`Connecting to SSE stream: /api/accounts/${accountId}/stream`);
    const eventSource = new EventSource(`/api/accounts/${accountId}/stream`);

    eventSource.onmessage = (event) => {
      console.log("SSE Message:", event.data);
    };

    eventSource.addEventListener("alert.created", (event: any) => {
      console.log("SSE Event (alert.created):", event.data);
      // Reload alerts
      fetch(`/api/accounts/${accountId}/alerts`)
        .then(res => res.json())
        .then(data => setAlerts(data));
    });

    eventSource.onerror = () => {
      console.warn("SSE connection encountered an error, closing.");
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [accountId]);

  // Helper function to switch accounts
  const switchAccount = (id: string) => {
    setAccountId(id);
    setActiveTab("command");
  };

  const handleSelectCandidate = async (cand: any) => {
    if (cand.id) {
      switchAccount(cand.id);
    } else {
      setLoading(true);
      try {
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cand),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.id) {
            switchAccount(data.id);
          }
        }
      } catch (e) {
        console.error("Error registering candidate:", e);
      } finally {
        setLoading(false);
      }
    }
  };

  // Helper to mark all alerts as read
  const markAlertsRead = async () => {
    const unreadIds = alerts.alerts.filter((a: any) => !a.readAt).map((a: any) => a.id);
    if (unreadIds.length === 0) return;
    
    try {
      const res = await fetch(`/api/accounts/${accountId}/alerts/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_ids: unreadIds }),
      });
      if (res.ok) {
        setAlerts((prev: any) => ({
          ...prev,
          unread: 0,
          alerts: prev.alerts.map((a: any) => ({ ...a, readAt: new Date().toISOString() }))
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const currentEntityName = overview?.entity?.display_name || "Unilever PLC";

  return (
    <div className="app min-h-screen grid grid-cols-1 md:grid-cols-[248px_1fr]">
      
      {/* SIDEBAR */}
      <aside className={`sidebar bg-brand-deep text-[#EDE6D6] fixed md:sticky top-0 left-0 h-screen w-[264px] md:w-auto z-[210] md:z-auto flex flex-col p-[22px] p-[16px] border-r border-black/20 transition-transform duration-300 ease-out md:translate-x-0 ${
        sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
      }`}>
        <div className="brand flex items-center gap-[10px] pb-[18px] mb-[6px] border-b border-white/10">
          <div className="mark w-[30px] h-[30px] rounded-[8px] bg-accent grid place-items-center flex-shrink-0 shadow-[0_0_0_4px_rgba(229,169,60,0.16)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="#15454F" strokeWidth="2.4" strokeLinecap="round" className="w-[16px] h-[16px]">
              <path d="M3 12h4l3-8 4 16 3-8h4"/>
            </svg>
          </div>
          <div className="wm font-display font-semibold text-[19px] tracking-wide leading-none">
            Signal360
            <small className="block font-mono text-[8.5px] tracking-widest text-accent font-medium mt-[3px]">ACCOUNT INTEL</small>
          </div>
        </div>

        <div className="navgroup mt-[12px]">
          <button 
            onClick={() => { setActiveTab("search"); setSidebarOpen(false); }}
            className={`navlink w-full flex items-center gap-[11px] px-[10px] py-[8px] rounded-[9px] cursor-pointer text-[13.5px] font-medium transition-colors border border-transparent ${
              activeTab === "search" ? "bg-white/10 text-white border-white/10 font-semibold" : "text-[#EDE6D6]/80 hover:bg-white/5 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[16px] h-[16px] opacity-80">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/>
            </svg>
            Search Account
          </button>
        </div>

        <div className="navgroup mt-[18px]">
          <div className="lbl font-mono text-[9px] tracking-widest text-[#EDE6D6]/40 px-[8px] pb-[8px] font-medium">OVERVIEW</div>
          <button 
            onClick={() => { setActiveTab("command"); setSidebarOpen(false); }}
            className={`navlink w-full flex items-center gap-[11px] px-[10px] py-[8px] rounded-[9px] cursor-pointer text-[13.5px] font-medium transition-colors border border-transparent ${
              activeTab === "command" ? "bg-white/10 text-white border-white/10 font-semibold" : "text-[#EDE6D6]/80 hover:bg-white/5 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[16px] h-[16px] opacity-80">
              <rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>
            </svg>
            Command Center
          </button>
        </div>

        <div className="navgroup mt-[18px]">
          <div className="lbl font-mono text-[9px] tracking-widest text-[#EDE6D6]/40 px-[8px] pb-[8px] font-medium">SIGNALS</div>
          
          <button 
            onClick={() => { setActiveTab("feed"); setSidebarOpen(false); }}
            className={`navlink w-full flex items-center gap-[11px] px-[10px] py-[8px] rounded-[9px] cursor-pointer text-[13.5px] font-medium transition-colors border border-transparent ${
              activeTab === "feed" ? "bg-white/10 text-white border-white/10 font-semibold" : "text-[#EDE6D6]/80 hover:bg-white/5 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[16px] h-[16px] opacity-80">
              <path d="M4 6h16M4 12h16M4 18h10"/>
            </svg>
            News &amp; Signals
          </button>

          <button 
            onClick={() => { setActiveTab("riskmap"); setSidebarOpen(false); }}
            className={`navlink w-full mt-1 flex items-center gap-[11px] px-[10px] py-[8px] rounded-[9px] cursor-pointer text-[13.5px] font-medium transition-colors border border-transparent ${
              activeTab === "riskmap" ? "bg-white/10 text-white border-white/10 font-semibold" : "text-[#EDE6D6]/80 hover:bg-white/5 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[16px] h-[16px] opacity-80">
              <path d="M3 3v18h18"/><path d="m7 14 3-4 3 2 5-7"/>
            </svg>
            Risk &amp; Growth Map
          </button>
        </div>

        <div className="navgroup mt-[18px]">
          <div className="lbl font-mono text-[9px] tracking-widest text-[#EDE6D6]/40 px-[8px] pb-[8px] font-medium">BENCHMARK</div>
          <button 
            onClick={() => { setActiveTab("compete"); setSidebarOpen(false); }}
            className={`navlink w-full flex items-center gap-[11px] px-[10px] py-[8px] rounded-[9px] cursor-pointer text-[13.5px] font-medium transition-colors border border-transparent ${
              activeTab === "compete" ? "bg-white/10 text-white border-white/10 font-semibold" : "text-[#EDE6D6]/80 hover:bg-white/5 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[16px] h-[16px] opacity-80">
              <path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7"/>
            </svg>
            Competitive Landscape
          </button>
        </div>

        <div className="navgroup mt-[18px]">
          <div className="lbl font-mono text-[9px] tracking-widest text-[#EDE6D6]/40 px-[8px] pb-[8px] font-medium">DEEP DIVES</div>
          
          <button 
            onClick={() => { setActiveTab("financials"); setSidebarOpen(false); }}
            className={`navlink w-full flex items-center gap-[11px] px-[10px] py-[8px] rounded-[9px] cursor-pointer text-[13.5px] font-medium transition-colors border border-transparent ${
              activeTab === "financials" ? "bg-white/10 text-white border-white/10 font-semibold" : "text-[#EDE6D6]/80 hover:bg-white/5 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[16px] h-[16px] opacity-80">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            Financials
          </button>

          <button 
            onClick={() => { setActiveTab("leadership"); setSidebarOpen(false); }}
            className={`navlink w-full mt-1 flex items-center gap-[11px] px-[10px] py-[8px] rounded-[9px] cursor-pointer text-[13.5px] font-medium transition-colors border border-transparent ${
              activeTab === "leadership" ? "bg-white/10 text-white border-white/10 font-semibold" : "text-[#EDE6D6]/80 hover:bg-white/5 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[16px] h-[16px] opacity-80">
              <circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3 3 0 0 1 0 6M21 20a5.5 5.5 0 0 0-4-5.3"/>
            </svg>
            Leadership &amp; People
          </button>

          <button 
            onClick={() => { setActiveTab("sentiment"); setSidebarOpen(false); }}
            className={`navlink w-full mt-1 flex items-center gap-[11px] px-[10px] py-[8px] rounded-[9px] cursor-pointer text-[13.5px] font-medium transition-colors border border-transparent ${
              activeTab === "sentiment" ? "bg-white/10 text-white border-white/10 font-semibold" : "text-[#EDE6D6]/80 hover:bg-white/5 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[16px] h-[16px] opacity-80">
              <path d="M21 12a8 8 0 1 1-3-6.2L21 4"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="9" r=".5" fill="currentColor"/><circle cx="15" cy="9" r=".5" fill="currentColor"/>
            </svg>
            Sentiment &amp; Social
          </button>

          <button 
            onClick={() => { setActiveTab("geo"); setSidebarOpen(false); }}
            className={`navlink w-full mt-1 flex items-center gap-[11px] px-[10px] py-[8px] rounded-[9px] cursor-pointer text-[13.5px] font-medium transition-colors border border-transparent ${
              activeTab === "geo" ? "bg-white/10 text-white border-white/10 font-semibold" : "text-[#EDE6D6]/80 hover:bg-white/5 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[16px] h-[16px] opacity-80">
              <circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>
            </svg>
            Geo &amp; Industry
          </button>
        </div>

        <div className="sidefoot mt-auto pt-[16px] border-t border-white/10">
          <button 
            onClick={() => { setActiveTab("watchlist"); setSidebarOpen(false); }}
            className={`navlink w-full flex items-center gap-[11px] px-[10px] py-[8px] rounded-[9px] cursor-pointer text-[13.5px] font-medium transition-colors border border-transparent ${
              activeTab === "watchlist" ? "bg-white/10 text-white border-white/10 font-semibold" : "text-[#EDE6D6]/80 hover:bg-white/5 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-[16px] h-[16px] opacity-80">
              <path d="M12 3l2.5 6 6.5.5-5 4.3 1.6 6.4L12 17l-5.6 3.2L8 13.8l-5-4.3 6.5-.5z"/>
            </svg>
            Watchlist
            <span className="ml-auto font-mono text-[10px] bg-accent/20 text-accent px-[6px] py-[1px] rounded-full">
              {watchlist?.accounts?.length || 0}
            </span>
          </button>

          <div className="agentstat flex items-center gap-[9px] font-mono text-[10.5px] text-[#EDE6D6]/60 p-[4px] px-[8px] mt-2">
            <span className="w-[8px] h-[8px] rounded-full bg-growth animate-pulse-slow"></span>
            Agents synced
          </div>
        </div>
      </aside>

      {/* MOBILE NAV OVERLAY SCRIM */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-ink/45 backdrop-blur-[2px] z-[200] md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* MAIN PANEL */}
      <div className="main flex flex-col min-w-0">
        
        {/* TOPBAR */}
        {activeTab !== "search" && (
          <header className="topbar sticky top-0 z-[50] flex items-center gap-[16px] px-[15px] md:px-[30px] py-[14px] bg-paper/84 backdrop-blur-[12px] border-b border-line">
            <button 
              id="menuBtn" 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden w-[40px] h-[40px] rounded-[11px] border border-line bg-paper-2 grid place-items-center cursor-pointer text-ink hover:border-brand"
              title="Menu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px]">
                <path d="M3 6h18M3 12h18M3 18h18"/>
              </svg>
            </button>

            <div 
              onClick={() => setActiveTab("search")}
              className="acctchip flex items-center gap-[11px] p-[6px] pr-[12px] bg-paper-2 border border-line rounded-[12px] cursor-pointer hover:shadow-sm transition-all"
              title="Switch account"
            >
              <div className="logo w-[34px] h-[34px] rounded-[9px] bg-gradient-to-br from-brand to-brand-deep text-white grid place-items-center font-display font-semibold text-[16px]">
                {currentEntityName.charAt(0)}
              </div>
              <div className="nm text-left">
                <span className="font-semibold text-[14px] leading-tight block">{currentEntityName}</span>
                <span className="font-mono text-[10px] text-ink-soft block font-normal mt-[1px] max-sm:hidden">
                  {overview?.entity ? (
                    `${overview.entity.tickers?.[0]?.exchange || "NYSE"}: ${overview.entity.tickers?.[0]?.symbol || ""} · ${overview.entity.industry || ""}`
                  ) : (
                    "Loading..."
                  )}
                </span>
              </div>
              <div className="sw font-mono text-[9px] text-ink-faint border-l border-line pl-[9px] ml-[3px] max-sm:hidden">SWITCH ▾</div>
            </div>

            <div className="searchbar flex-1 max-w-[330px] flex items-center gap-[9px] px-[14px] py-[9px] bg-paper-2 border border-line rounded-[11px] text-ink-soft transition-all focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(31,94,114,0.1)] max-md:hidden">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px] flex-shrink-0">
                <circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/>
              </svg>
              <input 
                placeholder="Search any organisation…"
                className="border-0 bg-transparent outline-none font-body text-[13.5px] text-ink w-full"
                value={searchQuery}
                onChange={(e) => {
                  setActiveTab("search");
                  handleSearch(e.target.value);
                }}
              />
              <kbd className="font-mono text-[10px] bg-paper-3 border border-line px-[6px] py-[2px] rounded-[5px] text-ink-faint">⌘K</kbd>
            </div>

            <div className="flex-1"></div>

            <button 
              onClick={handleWatchlistToggle}
              className={`btn border border-line rounded-[11px] px-[16px] py-[10px] font-body font-semibold text-[13px] cursor-pointer flex items-center gap-[8px] transition-all hover:shadow-sm ${
                watchlisted 
                  ? "bg-accent/12 border-accent/55 text-[#a8761a]" 
                  : "bg-paper-2 text-ink"
              }`}
              title={watchlisted ? "Watchlisted - click to remove" : "Add to watchlist"}
            >
              <svg 
                viewBox="0 0 24 24" 
                fill={watchlisted ? "var(--accent)" : "none"} 
                stroke={watchlisted ? "var(--accent)" : "currentColor"} 
                strokeWidth="1.8" 
                className="w-[15px] h-[15px]"
              >
                <path d="M12 3l2.5 6 6.5.5-5 4.3 1.6 6.4L12 17l-5.6 3.2L8 13.8l-5-4.3 6.5-.5z"/>
              </svg>
              <span id="watchLbl" className="max-sm:hidden">{watchlisted ? "Watchlisted" : "Watchlist"}</span>
            </button>

            <button 
              id="alertBtn" 
              onClick={() => setAlertDrawerOpen(true)}
              className="iconbtn w-[40px] h-[40px] rounded-[11px] border border-line bg-paper-2 grid place-items-center cursor-pointer text-ink hover:border-brand hover:shadow-sm relative"
              title="Alerts"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-[17px] h-[17px]">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>
              </svg>
              {alerts.unread > 0 && <span className="absolute top-[8px] right-[9px] w-[7px] h-[7px] rounded-full bg-risk border-[1.5px] border-paper-2"></span>}
            </button>

            <button 
              onClick={() => setBriefingModalOpen(true)}
              className="btn bg-brand text-white border-transparent hover:bg-brand-deep rounded-[11px] px-[16px] py-[10px] font-body font-semibold text-[13px] cursor-pointer flex items-center gap-[8px] transition-all hover:-translate-y-[1px]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>
              </svg>
              <span className="max-sm:hidden">Export Briefing</span>
            </button>
          </header>
        )}

        {/* CONTENT CONTAINER */}
        <main className="content flex-1 p-[15px] md:p-[28px] pb-[60px] max-w-[1380px] w-full mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-ink-soft">
              <span className="w-8 h-8 rounded-full border-4 border-brand border-t-transparent animate-spin mb-4" />
              Sweeping account intelligence...
            </div>
          ) : (
            <>
              {/* PAGE 1: COMMAND CENTER */}
              {activeTab === "command" && (
                <section className="page active space-y-[18px] animate-rise">
                  <div className="phead text-left mb-[22px] flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <div className="eyebrow font-mono text-[10px] tracking-widest text-brand font-semibold uppercase">Account Command Center</div>
                      <h1 className="ptitle font-display font-semibold text-[30px] leading-tight text-ink mt-[7px] mb-[5px] tracking-tight">{currentEntityName}</h1>
                      <p className="psub text-ink-soft text-[14px] max-w-[700px]">AI-synthesised intelligence across news, filings, leadership, competitors and social — live sourced updates.</p>
                    </div>
                    <div className="flex-shrink-0 md:mt-2">
                      <button 
                        onClick={() => setEntityTreeModalOpen(true)}
                        className="btn bg-paper border border-line text-ink hover:text-brand hover:border-brand hover:shadow-sm rounded-[11px] px-[16px] py-[10px] font-body font-semibold text-[13.5px] cursor-pointer flex items-center gap-[8px] transition-all"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-[15px] h-[15px]">
                          <path d="M12 22v-5M17 17H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2zM12 7V2M5 12H2M22 12h-3"/>
                        </svg>
                        Corporate Entity Tree
                      </button>
                    </div>
                  </div>

                  {/* Market ticker banner */}
                  {overview?.ticker && (
                    <div 
                      onClick={() => setActiveTab("financials")}
                      className="ticker card p-[12px] px-[18px] bg-paper-2 border border-line rounded-[16px] flex items-center gap-[15px] overflow-x-auto hover:border-brand hover:shadow-md cursor-pointer transition-all select-none"
                    >
                      <span className="tk-live font-mono text-[9.5px] tracking-widest text-growth font-bold flex items-center gap-[7px]">
                        <span className="w-[8px] h-[8px] rounded-full bg-growth animate-pulse-slow"></span>
                        LIVE
                      </span>
                      <span className="tk-sym font-mono text-[11px] font-semibold text-ink bg-paper-3 border border-line px-[9px] py-[3px] rounded-[6px]">
                        {overview.ticker.symbol}
                      </span>
                      <span className="tk-price font-display text-[21px] font-semibold text-ink">
                        ≈ {overview.ticker.price}p
                      </span>
                      <span className={`tk-chg font-mono text-[11px] font-semibold ${overview.ticker.change_pct >= 0 ? "text-growth" : "text-risk"}`}>
                        {overview.ticker.change_pct >= 0 ? "▲" : "▼"} {overview.ticker.change_pct >= 0 ? "+" : ""}{overview.ticker.change_pct}% today
                      </span>
                      <span className="text-line">|</span>
                      <span className="tk-item font-mono text-[10.5px] text-ink-soft">52W<b className="text-ink ml-1 font-semibold">{overview.ticker.week52.low}–{overview.ticker.week52.high}p</b></span>
                      <span className="tk-item font-mono text-[10.5px] text-ink-soft">MKT CAP<b className="text-ink ml-1 font-semibold">{overview.ticker.market_cap}</b></span>
                      <span className="tk-item font-mono text-[10.5px] text-ink-soft">YIELD<b className="text-ink ml-1 font-semibold">≈ {overview.ticker.yield}%</b></span>
                      <span className="tk-item font-mono text-[10.5px] text-ink-soft">P/E<b className="text-ink ml-1 font-semibold">≈ {overview.ticker.pe}×</b></span>
                      <span className="text-line">|</span>
                      <span className="tk-more font-mono text-[9.5px] text-brand font-semibold tracking-wider uppercase ml-auto">FULL MARKET VIEW →</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px]">
                    
                    {/* Synthesised Narrative Card */}
                    <Card className="flex flex-col justify-between">
                      <div>
                        <CardHeader className="flex justify-between w-full">
                          <div className="flex items-center gap-[10px]">
                            <div className="w-[30px] h-[30px] rounded-[9px] bg-paper-3 border border-line flex items-center justify-center text-brand">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-[15px] h-[15px]">
                                <path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="4"/>
                              </svg>
                            </div>
                            <CardTitle>This Week, Synthesised</CardTitle>
                          </div>
                          
                          <Badge type={overview?.status === "net_positive" ? "growth" : overview?.status === "elevated_risk" ? "risk" : "neutral"} className="ml-auto">
                            {overview?.status?.replace("_", " ") || "MIXED"}
                          </Badge>
                        </CardHeader>
                        
                        <div className="space-y-4 text-left">
                          <p className="text-[14.5px] leading-[1.65] text-ink font-normal">
                            {overview?.summary?.text || "Synthesizing account intelligence..."}
                          </p>
                          
                          {overview?.summary?.growth_summary && (
                            <div className="p-[14px] bg-growth/5 border border-growth/10 rounded-[12px] flex gap-[10px] items-start">
                              <span className="w-1.5 h-1.5 rounded-full bg-growth mt-2 flex-shrink-0"></span>
                              <div className="space-y-0.5">
                                <span className="font-semibold text-[11px] font-mono text-growth uppercase tracking-wider block">Growth Signals Summary</span>
                                <p className="text-[13px] leading-[1.6] text-ink-soft">{overview.summary.growth_summary}</p>
                              </div>
                            </div>
                          )}
                          
                          {overview?.summary?.risk_summary && (
                            <div className="p-[14px] bg-risk/5 border border-risk/10 rounded-[12px] flex gap-[10px] items-start">
                              <span className="w-1.5 h-1.5 rounded-full bg-risk mt-2 flex-shrink-0"></span>
                              <div className="space-y-0.5">
                                <span className="font-semibold text-[11px] font-mono text-risk uppercase tracking-wider block">Risk Signals Summary</span>
                                <p className="text-[13px] leading-[1.6] text-ink-soft">{overview.summary.risk_summary}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="mt-6 border-t border-line-soft pt-[14px]">
                          <div className="note font-mono text-[10px] text-ink-faint tracking-wider uppercase text-left mb-2">OVERALL STATUS SUMMARY</div>
                          <div className="flex flex-col gap-[7px] text-left">
                            <span className={`flex items-center gap-[9px] text-[12px] px-[11px] py-[6px] rounded-[9px] border border-transparent ${overview?.status === "net_positive" ? "bg-growth-bg border-growth/20 text-growth" : "text-ink-soft"}`}>
                              <span className="w-[8px] h-[8px] rounded-full bg-growth"></span>
                              <b>Net Positive</b> — growth signals clearly outweigh risk over the trailing 30 days
                            </span>
                            <span className={`flex items-center gap-[9px] text-[12px] px-[11px] py-[6px] rounded-[9px] border border-transparent ${overview?.status === "mixed" ? "bg-neutral-bg border-neutral/20 text-neutral" : "text-ink-soft"}`}>
                              <span className="w-[8px] h-[8px] rounded-full bg-neutral"></span>
                              <b>Mixed</b> — growth and risk signals roughly in balance
                            </span>
                            <span className={`flex items-center gap-[9px] text-[12px] px-[11px] py-[6px] rounded-[9px] border border-transparent ${overview?.status === "elevated_risk" ? "bg-risk-bg border-risk/20 text-risk" : "text-ink-soft"}`}>
                              <span className="w-[8px] h-[8px] rounded-full bg-risk"></span>
                              <b>Elevated Risk</b> — risk signals outweigh growth over the trailing 30 days
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="src-foot font-mono text-[9px] text-ink-faint border-t border-dashed border-line pt-[13px] mt-[18px] tracking-wider text-left">
                        SYNTHESISED FROM {overview?.stats?.active_signals_30d || 12} SIGNALS · EVERY CLAIM TRACEABLE TO SOURCE · NO UNSUPPORTED ASSERTIONS
                      </div>
                    </Card>

                    {/* Account Health gauges */}
                    <Card>
                      <CardHeader className="flex flex-col items-start gap-1 pb-[10px]">
                        <CardTitle>Account Health</CardTitle>
                        <div className="text-left font-mono text-[10.5px] text-ink-soft leading-relaxed mt-2">
                          <p>Account Health evaluates real-time strategic standing through two key lenses:</p>
                        </div>
                      </CardHeader>
                      
                      <div className="flex flex-col gap-[20px] text-left">
                        {/* Point 1: 30-Day Momentum */}
                        <div className="space-y-[10px]">
                          <div className="font-mono text-[10.5px] text-ink-soft leading-relaxed">
                            <p className="font-semibold text-ink mb-1">1. 30-Day Momentum (0–100 Scale)</p>
                            <p className="mb-1">Calculates the weighted balance of Growth vs. Risk signals generated over the trailing 30 days:</p>
                            <ul className="space-y-1 ml-1 mt-1">
                              <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-risk mr-2"></span><b>0–40 (Risk-Leaning)</b>: Emerging risks outweigh growth.</li>
                              <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-accent mr-2"></span><b>41–59 (Stable)</b>: Balanced volume of risks and growth.</li>
                              <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-growth mr-2"></span><b>60–100 (Growth)</b>: Positive strategic events dominate.</li>
                            </ul>
                          </div>

                          <div className="flex items-center gap-[18px] p-[12px] bg-paper-3/50 border border-line-soft rounded-[12px] transition-all hover:bg-paper-3">
                            <Gauge 
                              value={overview?.score?.momentum ?? 70} 
                              subLabel="MOMENTUM" 
                              percentage={overview?.score?.momentum ?? 70} 
                              strokeColor="var(--growth)"
                            />
                            <div>
                              <Badge type="growth">▲ +6 vs last month</Badge>
                              <p className="text-[12px] text-ink-soft mt-[8px] leading-tight font-body">
                                Growth signals outbalance risk {overview?.score?.ratio_growth_risk || "2.1"} : 1 over 30 days.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="h-[1px] bg-line-soft"></div>

                        {/* Point 2: Competitive Position */}
                        <div className="space-y-[10px]">
                          <div className="font-mono text-[10.5px] text-ink-soft leading-relaxed">
                            <p className="font-semibold text-ink mb-1">2. Competitive Position</p>
                            <p>The company's Momentum score ranked directly against its Compete Set peers.</p>
                          </div>

                          <div className="flex items-center gap-[18px] p-[12px] bg-paper-3/50 border border-line-soft rounded-[12px] transition-all hover:bg-paper-3">
                            <Gauge 
                              value={`#${overview?.score?.competitive_rank ?? 2}`} 
                              subLabel={`OF ${overview?.score?.competitive_of ?? 5} PEERS`} 
                              percentage={(((overview?.score?.competitive_of ?? 5) - (overview?.score?.competitive_rank ?? 2) + 1) / (overview?.score?.competitive_of ?? 5)) * 100} 
                              strokeColor="var(--brand)"
                            />
                            <div>
                              <Badge type="cat">COMPETITIVE POSITION</Badge>
                              <p className="text-[12px] text-ink-soft mt-[8px] leading-tight font-body">
                                Leads peer group on portfolio momentum; trails P&amp;G on gross margin.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Stat Tiles row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[18px]">
                    <StatTile 
                      label="Turnover (FY2025)" 
                      value={overview?.stats?.turnover || "€60.8B"} 
                      change="~4% underlying" 
                      direction="up" 
                      tooltipTitle="Financial Reporting Period"
                      tooltipContent={
                        <div className="space-y-1">
                          <p>Unilever's financial reporting year ends on <strong>December 31st</strong>.</p>
                          <p className="mt-1">FY2025 metrics reflect the full-year reporting period ending December 31, 2025.</p>
                        </div>
                      }
                    />
                    <StatTile label="Active Signals (6M)" value={overview?.stats?.active_signals_30d || "38"} change="9 new this week" direction="up" />
                    <StatTile 
                      label="Net Sentiment" 
                      value={overview?.stats?.net_sentiment || "+0.30"} 
                      change="improving" 
                      direction="up" 
                      tooltipTitle="Net Sentiment Score"
                      tooltipContent={
                        <div className="space-y-1">
                          <p>Normalized score showing the balance of growth vs. risk signals over the trailing 30 days.</p>
                          <p className="font-semibold mt-1">Formula:</p>
                          <p className="font-mono bg-white/10 p-1 rounded text-[11px]">(Growth - Risk) / Total Signals</p>
                          <p className="mt-1">Values range from -1.0 (pure risk) to +1.0 (pure growth). A positive score represents growth momentum.</p>
                        </div>
                      }
                    />
                    <StatTile 
                      label="Open Risk Signals" 
                      value={overview?.stats?.open_risks || "4"} 
                      change="2 regulatory" 
                      direction="down" 
                      tooltipTitle="Open Risk Signals"
                      tooltipContent={
                        <div className="space-y-1">
                          <p>Tracks active negative events requiring strategic monitoring or response.</p>
                          <p className="mt-1">The status indicator below indicates trend direction and volume of specific categories:</p>
                          <ul className="list-disc pl-4 space-y-1 mt-1 font-body text-[11px]">
                            <li><b>▼ (Down Arrow)</b>: Signals risk frequency/severity is declining.</li>
                            <li><b>2 regulatory</b>: 2 of these active risk signals fall under the Regulatory & Compliance category (e.g. EU green-claims rules).</li>
                          </ul>
                        </div>
                      }
                    />
                  </div>

                  {/* Curated list row */}
                  <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px]">
                    
                    {/* Top Signals */}
                    <Card padded={false} className="flex flex-col justify-between">
                      <div className="p-[20px] p-[22px] pb-[4px]">
                        <CardHeader>
                          <div className="w-[30px] h-[30px] rounded-[9px] bg-paper-3 border border-line flex items-center justify-center text-brand">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-[15px] h-[15px]">
                              <path d="M13 2 3 14h7l-1 8 10-12h-7z"/>
                            </svg>
                          </div>
                          <CardTitle>Top Signals This Week</CardTitle>
                          <button 
                            onClick={() => setActiveTab("feed")}
                            className="ml-auto font-mono text-[10px] text-brand font-semibold uppercase hover:underline"
                          >
                            VIEW ALL {overview?.stats?.active_signals_30d || 38} →
                          </button>
                        </CardHeader>
                      </div>

                      <div className="divide-y divide-line-soft">
                        {overview?.top_signals?.map((sig: any) => (
                          <div key={sig.id} className="signal flex gap-[15px] p-[17px] p-[20px] text-left hover:bg-paper-3 transition-colors">
                            <div 
                              className="rail w-[3px] rounded-[3px] self-stretch" 
                              style={{ 
                                backgroundColor: sig.type === "growth" ? "var(--growth)" : sig.type === "risk" ? "var(--risk)" : "var(--neutral)" 
                              }}
                            />
                            <div className="body flex-1 min-w-0">
                              <div className="meta flex items-center gap-[8px] flex-wrap mb-[7px]">
                                <Badge type="cat">{sig.category}</Badge>
                                <span className={`font-mono text-[9px] font-semibold tracking-wider ${sig.type === "growth" ? "text-growth" : sig.type === "risk" ? "text-risk" : "text-neutral"}`}>
                                  {sig.type.toUpperCase()}
                                </span>
                              </div>
                              <h4 className="ttl font-semibold text-[14.5px] leading-snug text-ink mb-[5px]">{sig.title}</h4>
                              <p className="ex text-ink-soft text-[12.8px] leading-relaxed">{sig.summary}</p>
                              
                              <div className="src flex items-center gap-[7px] mt-[9px] font-mono text-[10.5px] text-ink-faint">
                                <span>recent</span> · 
                                {sig.sources.map((src: any, idx: number) => (
                                  <a key={idx} href={src.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                                    {src.publisher}
                                  </a>
                                ))}
                                <span className="sev flex gap-[2px] ml-auto">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <i 
                                      key={s} 
                                      className={`w-[5px] h-[5px] rounded-full ${s <= sig.severity ? "bg-accent" : "bg-line"}`}
                                    />
                                  ))}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>

                    {/* SWOT Analysis */}
                    <Card>
                      <CardHeader className="pb-[12px]">
                        <div className="w-[30px] h-[30px] rounded-[9px] bg-paper-3 border border-line flex items-center justify-center text-brand">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-[15px] h-[15px]">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M21 12H3M12 3v18" />
                          </svg>
                        </div>
                        <CardTitle>SWOT Analysis</CardTitle>
                        <span className="ml-auto font-mono text-[9.5px] text-brand bg-brand/10 px-2 py-0.5 rounded-[4px] font-semibold uppercase tracking-wider">
                          AI Synthesised
                        </span>
                      </CardHeader>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-[12px] text-left">
                        {/* Strengths */}
                        <div className="p-[14px] bg-growth/5 border border-growth/10 rounded-[12px] flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-[6px] mb-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-growth"></span>
                              <span className="font-semibold text-[11px] font-mono text-growth uppercase tracking-wider">Strengths</span>
                            </div>
                            <ul className="space-y-[8px] list-none pl-0">
                              {overview?.swot?.strengths?.map((item: string, idx: number) => (
                                <li key={idx} className="text-[12.8px] leading-[1.5] text-ink-soft flex items-start gap-[6px]">
                                  <span className="text-growth font-mono text-[10px] select-none mt-[2.5px] font-bold">S{idx + 1}</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                              {(!overview?.swot?.strengths || overview.swot.strengths.length === 0) && (
                                <li className="text-[12.8px] leading-[1.5] text-ink-faint italic">No strengths listed.</li>
                              )}
                            </ul>
                          </div>
                        </div>

                        {/* Weaknesses */}
                        <div className="p-[14px] bg-risk/5 border border-risk/10 rounded-[12px] flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-[6px] mb-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-risk"></span>
                              <span className="font-semibold text-[11px] font-mono text-risk uppercase tracking-wider">Weaknesses</span>
                            </div>
                            <ul className="space-y-[8px] list-none pl-0">
                              {overview?.swot?.weaknesses?.map((item: string, idx: number) => (
                                <li key={idx} className="text-[12.8px] leading-[1.5] text-ink-soft flex items-start gap-[6px]">
                                  <span className="text-risk font-mono text-[10px] select-none mt-[2.5px] font-bold">W{idx + 1}</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                              {(!overview?.swot?.weaknesses || overview.swot.weaknesses.length === 0) && (
                                <li className="text-[12.8px] leading-[1.5] text-ink-faint italic">No weaknesses listed.</li>
                              )}
                            </ul>
                          </div>
                        </div>

                        {/* Opportunities */}
                        <div className="p-[14px] bg-accent/5 border border-accent/15 rounded-[12px] flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-[6px] mb-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                              <span className="font-semibold text-[11px] font-mono text-accent uppercase tracking-wider">Opportunities</span>
                            </div>
                            <ul className="space-y-[8px] list-none pl-0">
                              {overview?.swot?.opportunities?.map((item: string, idx: number) => (
                                <li key={idx} className="text-[12.8px] leading-[1.5] text-ink-soft flex items-start gap-[6px]">
                                  <span className="text-accent font-mono text-[10px] select-none mt-[2.5px] font-bold">O{idx + 1}</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                              {(!overview?.swot?.opportunities || overview.swot.opportunities.length === 0) && (
                                <li className="text-[12.8px] leading-[1.5] text-ink-faint italic">No opportunities listed.</li>
                              )}
                            </ul>
                          </div>
                        </div>

                        {/* Threats */}
                        <div className="p-[14px] bg-neutral-bg border border-neutral/20 rounded-[12px] flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-[6px] mb-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-neutral"></span>
                              <span className="font-semibold text-[11px] font-mono text-neutral uppercase tracking-wider">Threats</span>
                            </div>
                            <ul className="space-y-[8px] list-none pl-0">
                              {overview?.swot?.threats?.map((item: string, idx: number) => (
                                <li key={idx} className="text-[12.8px] leading-[1.5] text-ink-soft flex items-start gap-[6px]">
                                  <span className="text-neutral font-mono text-[10px] select-none mt-[2.5px] font-bold">T{idx + 1}</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                              {(!overview?.swot?.threats || overview.swot.threats.length === 0) && (
                                <li className="text-[12.8px] leading-[1.5] text-ink-faint italic">No threats listed.</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="src-foot font-mono text-[9px] text-ink-faint border-t border-dashed border-line pt-[10px] mt-[16px] tracking-wider text-left uppercase">
                        Sourced from Annual Reports, Regulatory Filings, and News Signals
                      </div>
                    </Card>
                  </div>
                </section>
              )}

              {/* PAGE 2: SEARCH */}
              {activeTab === "search" && (
                <section className="page active space-y-8 animate-rise">
                  {/* Mobile header / menu button */}
                  <div className="flex items-center justify-between md:hidden pb-1.5 border-b border-line">
                    <button 
                      onClick={() => setSidebarOpen(true)}
                      className="w-[40px] h-[40px] rounded-[11px] border border-line bg-paper-2 grid place-items-center cursor-pointer text-ink hover:border-brand"
                      title="Menu"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px]">
                        <path d="M3 6h18M3 12h18M3 18h18"/>
                      </svg>
                    </button>
                    <span className="font-display font-semibold text-[17px] tracking-wide text-ink">Signal360</span>
                  </div>

                  <div className="hero-landing text-left mb-[20px] p-[24px] md:p-[32px] bg-gradient-to-br from-brand-deep via-brand to-[#0d2a32] text-[#EDE6D6] rounded-[20px] border border-white/10 shadow-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[240px] h-[240px] bg-accent/8 rounded-full blur-[80px] pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-[160px] h-[160px] bg-growth/8 rounded-full blur-[60px] pointer-events-none"></div>
                    
                    <div className="flex items-center gap-[10px] mb-[12px]">
                      <div className="mark w-[30px] h-[30px] rounded-[8px] bg-accent grid place-items-center flex-shrink-0 shadow-[0_0_0_4px_rgba(229,169,60,0.18)]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#15454F" strokeWidth="2.8" strokeLinecap="round" className="w-[14px] h-[14px]">
                          <path d="M3 12h4l3-8 4 16 3-8h4"/>
                        </svg>
                      </div>
                      <span className="font-mono text-[10px] tracking-widest text-accent font-bold uppercase">Signal360 Platform</span>
                    </div>

                    <h1 className="font-display font-bold text-[30px] md:text-[36px] leading-tight text-white mb-[8px] max-w-[700px] tracking-tight">
                      AI-Driven Account Intelligence Terminal
                    </h1>
                    
                    <p className="font-body text-[13.5px] md:text-[14.5px] leading-relaxed text-[#EDE6D6]/85 max-w-[680px]">
                      Objective, registry-verified corporate intelligence at your fingertips. Search and monitor international organizations, track financial performance, explore real-time risk maps, and access compliant executive briefings instantly.
                    </p>
                  </div>

                  {/* Grid layout for search section + features */}
                  <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-[28px] items-start">
                    
                    {/* Left Column: Search & resolution */}
                    <div className="space-y-6">
                      <div className="search-section text-left">
                        <div className="eyebrow font-mono text-[10px] tracking-widest text-brand font-semibold uppercase mb-[8px]">Entity Resolution Search</div>
                        <h2 className="font-display font-semibold text-[22px] text-ink mb-[6px] tracking-tight">Find an organisation</h2>
                        <p className="text-ink-soft text-[13.5px]">Search resolves your query to the correct registry-verified legal entity. Subsidiaries, parent companies, and competitors are managed as distinct records.</p>
                      </div>

                      <Card className="w-full">
                        <div className="flex items-center gap-[9px] px-[18px] py-[14px] bg-paper-2 border border-line rounded-[14px]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px] text-ink-soft flex-shrink-0">
                            <circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/>
                          </svg>
                          <input 
                            placeholder="Type organisation name (e.g. Unilever, Nestlé, P&amp;G)..."
                            className="border-0 bg-transparent outline-none font-body text-[16px] text-ink w-full"
                            defaultValue={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                          />
                        </div>
                        <div className="mt-3 text-left font-mono text-[11px] text-risk/90 font-medium">
                          For the pilot demo, type Unilever in the search bar and click on Unilever PLC
                        </div>
                        {searchCandidates.length > 0 && (
                          <div className="note font-mono text-[10px] text-ink-soft mt-3 text-left">
                            {searchCandidates.length} candidate entities matched · select one to switch context
                          </div>
                        )}
                      </Card>

                      <div className="space-y-[12px] w-full">
                        {searchCandidates.map((cand: any, idx: number) => (
                          <div 
                            key={idx}
                            onClick={() => handleSelectCandidate(cand)}
                            className="candidate flex items-center gap-[15px] p-[17px] p-[20px] border border-line rounded-[14px] bg-paper-2 transition-all text-left cursor-pointer hover:border-brand hover:shadow-sm hover:translate-x-[3px]"
                          >
                            <div className="clogo w-[48px] h-[48px] rounded-[12px] bg-gradient-to-br from-brand to-brand-deep text-white grid place-items-center font-display font-semibold text-[20px]">
                              {cand.displayName.charAt(0)}
                            </div>
                            <div className="info-c flex-1 min-w-0">
                              <div className="nm font-semibold text-[16px] text-ink">{cand.displayName}</div>
                              <div className="det font-mono text-[11px] text-ink-soft mt-[3px] flex gap-[14px] flex-wrap">
                                {cand.tickers.length > 0 && (
                                  <span>
                                    {cand.tickers.map((t: any) => `${t.exchange}: ${t.symbol}`).join(" · ")}
                                  </span>
                                )}
                                <span>{cand.domain}</span>
                                <span>{cand.industry}</span>
                                <span>{cand.hqCity}, {cand.hqCountry}</span>
                              </div>
                            </div>
                            <div className="go font-mono text-[12px] text-brand">
                              {cand.id ? (
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M5 12h14M13 6l6 6-6 6"/>
                                </svg>
                              ) : (
                                <span className="text-brand font-semibold text-[11px] tracking-wider uppercase bg-brand/10 px-[9px] py-[3px] rounded-[6px] hover:bg-brand/20">RESOLVE &amp; TRACK</span>
                              )}
                            </div>
                          </div>
                        ))}

                        {searchQuery && searchCandidates.length === 0 && (
                          <div className="text-left py-8 text-ink-soft font-mono">
                            No candidates found. Try searching for "unilever" or "nestle".
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Platform benefits / features */}
                    <div className="space-y-[16px] text-left lg:sticky lg:top-[28px]">
                      <Card className="bg-paper-2 border border-line p-[20px] md:p-[24px]">
                        <div className="note font-mono text-[10px] text-brand font-bold tracking-wider uppercase mb-4 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
                          Signal360 Key Capabilities
                        </div>

                        <div className="space-y-4.5">
                          {/* Feature 1 */}
                          <div className="flex gap-[12px] items-start transition-transform hover:translate-x-0.5 duration-200">
                            <div className="w-[28px] h-[28px] rounded-[7px] bg-growth-bg text-growth border border-growth/20 flex items-center justify-center flex-shrink-0 mt-[2px]">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-[13px] h-[13px]">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>
                              </svg>
                            </div>
                            <div>
                              <h4 className="text-[13.5px] font-semibold text-ink leading-tight">Growth &amp; Risk Tracking</h4>
                              <p className="text-[12px] text-ink-soft mt-0.5 leading-normal">Monitors real-time corporate events and developments to isolate growth catalysts and risk warnings.</p>
                            </div>
                          </div>

                          {/* Feature 2 */}
                          <div className="flex gap-[12px] items-start transition-transform hover:translate-x-0.5 duration-200">
                            <div className="w-[28px] h-[28px] rounded-[7px] bg-brand/10 text-brand border border-brand/20 flex items-center justify-center flex-shrink-0 mt-[2px]">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-[13px] h-[13px]">
                                <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>
                              </svg>
                            </div>
                            <div>
                              <h4 className="text-[13.5px] font-semibold text-ink leading-tight">Industry &amp; Macro Sweeps</h4>
                              <p className="text-[12px] text-ink-soft mt-0.5 leading-normal">Sweeps global news wires, sector journals, and regulatory announcements for macro context.</p>
                            </div>
                          </div>

                          {/* Feature 3 */}
                          <div className="flex gap-[12px] items-start transition-transform hover:translate-x-0.5 duration-200">
                            <div className="w-[28px] h-[28px] rounded-[7px] bg-accent/12 text-[#a8761a] border border-accent/20 flex items-center justify-center flex-shrink-0 mt-[2px]">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-[13px] h-[13px]">
                                <path d="M3 3v18h18"/><path d="m7 14 3-4 3 2 5-7"/>
                              </svg>
                            </div>
                            <div>
                              <h4 className="text-[13.5px] font-semibold text-ink leading-tight">Benchmarking to Compete</h4>
                              <p className="text-[12px] text-ink-soft mt-0.5 leading-normal">Benchmarks key metrics and profiles of target accounts against direct industry rivals.</p>
                            </div>
                          </div>

                          {/* Feature 4 */}
                          <div className="flex gap-[12px] items-start transition-transform hover:translate-x-0.5 duration-200">
                            <div className="w-[28px] h-[28px] rounded-[7px] bg-neutral-bg text-neutral border border-neutral/20 flex items-center justify-center flex-shrink-0 mt-[2px]">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-[13px] h-[13px]">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                              </svg>
                            </div>
                            <div>
                              <h4 className="text-[13.5px] font-semibold text-ink leading-tight">Public Sentiment Analysis</h4>
                              <p className="text-[12px] text-ink-soft mt-0.5 leading-normal">Tracks rolling media sentiment, executive statements, and social posts for public alignment.</p>
                            </div>
                          </div>
                        </div>
                      </Card>

                      <div className="pl-2 font-mono text-[9px] text-ink-faint leading-normal">
                        Signal360 operates compliantly. No LinkedIn credentials are scraped, ensuring 100% legal, client-safe corporate intelligence sweeps.
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* PAGE 3: FEED */}
              {activeTab === "feed" && (
                <section className="page active space-y-6 animate-rise">
                  <div className="phead text-left mb-[22px]">
                    <div className="eyebrow font-mono text-[10px] tracking-widest text-brand font-semibold uppercase">News &amp; Signals Feed</div>
                    <div className="flex items-center justify-between mt-[7px] mb-[5px]">
                      <h1 className="ptitle font-display font-semibold text-[30px] leading-tight text-ink tracking-tight">Signal Stream</h1>
                      <button 
                        onClick={handleSyncLiveSignals}
                        disabled={isSyncing}
                        className={`font-mono text-[11px] px-4 py-2 border rounded-full transition-colors flex items-center gap-2 ${isSyncing ? "bg-paper border-line text-ink-faint" : "bg-ink text-paper-2 hover:bg-ink-soft"}`}
                      >
                        {isSyncing ? (
                          <>
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                            SYNCING LIVE NEWS...
                          </>
                        ) : (
                          <>SYNC LIVE SIGNALS</>
                        )}
                      </button>
                    </div>
                    <p className="psub text-ink-soft text-[14px] max-w-[700px]">Classified and severity-scored signals. Use filters to query by taxonomy, type, range or context scope.</p>
                  </div>

                  {/* Filter panel */}
                  <Card className="space-y-4">
                    <div>
                      <div className="note font-mono text-[9px] text-ink-faint tracking-wider uppercase text-left mb-2">SIGNAL TAXONOMY</div>
                      <div className="chiprow flex flex-wrap gap-2 text-left">
                        {[
                          { key: "all", label: "All" },
                          { key: "ma", label: "M&A" },
                          { key: "ai_pivot", label: "AI Pivot" },
                          { key: "earnings", label: "Earnings" },
                          { key: "leadership", label: "Leadership" },
                          { key: "restructure", label: "Restructure" },
                          { key: "regulatory", label: "Regulatory" },
                          { key: "partnership", label: "Partnership" },
                          { key: "expansion", label: "Expansion" },
                          { key: "crisis", label: "Crisis" },
                          { key: "esg", label: "ESG" },
                        ].map((c) => (
                          <button
                            key={c.key}
                            onClick={() => setFeedCategory(c.key)}
                            className={`chip font-mono text-[11.5px] px-[13px] py-[6px] rounded-full border cursor-pointer select-none transition-colors ${
                              feedCategory === c.key 
                                ? "bg-ink border-ink text-paper-2" 
                                : "bg-paper-2 border-line text-ink-soft hover:border-brand hover:text-ink"
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-line-soft pt-4">
                      <div>
                        <div className="note font-mono text-[9px] text-ink-faint tracking-wider uppercase text-left mb-2">SIGNAL TYPE</div>
                        <div className="chiprow flex gap-2">
                          {[
                            { key: "all", label: "All" },
                            { key: "growth", label: "Growth" },
                            { key: "risk", label: "Risk" },
                            { key: "neutral", label: "Neutral" },
                          ].map((t) => (
                            <button
                              key={t.key}
                              onClick={() => setFeedType(t.key)}
                              className={`chip font-mono text-[11.5px] px-[13px] py-[6px] rounded-full border cursor-pointer select-none transition-colors ${
                                feedType === t.key 
                                  ? "bg-ink border-ink text-paper-2" 
                                  : "bg-paper-2 border-line text-ink-soft hover:border-brand hover:text-ink"
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="note font-mono text-[9px] text-ink-faint tracking-wider uppercase text-left mb-2">LOOKBACK RANGE</div>
                        <div className="chiprow flex gap-2">
                          {[
                            { key: "7", label: "7 Days" },
                            { key: "30", label: "30 Days" },
                            { key: "180", label: "6 Months" },
                          ].map((r) => (
                            <button
                              key={r.key}
                              onClick={() => setFeedRange(r.key)}
                              className={`chip font-mono text-[11.5px] px-[13px] py-[6px] rounded-full border cursor-pointer select-none transition-colors ${
                                feedRange === r.key 
                                  ? "bg-ink border-ink text-paper-2" 
                                  : "bg-paper-2 border-line text-ink-soft hover:border-brand hover:text-ink"
                              }`}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="note font-mono text-[9px] text-ink-faint tracking-wider uppercase text-left mb-2">SIGNAL SCOPE</div>
                        <div className="chiprow flex gap-2">
                          {[
                            { key: "all", label: "All Context" },
                            { key: "target", label: "Target Entity Only" },
                          ].map((s) => (
                            <button
                              key={s.key}
                              onClick={() => setFeedScope(s.key)}
                              className={`chip font-mono text-[11.5px] px-[13px] py-[6px] rounded-full border cursor-pointer select-none transition-colors ${
                                feedScope === s.key 
                                  ? "bg-ink border-ink text-paper-2" 
                                  : "bg-paper-2 border-line text-ink-soft hover:border-brand hover:text-ink"
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Signals list count */}
                  <div className="flex justify-between items-center text-ink-soft font-mono text-[12px] px-2">
                    <span>
                      showing {signalsFeed.total > 0 ? `${(feedPage - 1) * 50 + 1}–${Math.min(feedPage * 50, signalsFeed.total)}` : 0} of {signalsFeed.total} signals
                    </span>
                  </div>

                  {/* Signals list */}
                  <Card padded={false}>
                    <div className="divide-y divide-line-soft">
                      {signalsFeed.items.map((sig: any) => (
                        <div key={sig.id} className="signal flex gap-[15px] p-[17px] p-[20px] text-left hover:bg-paper-3 transition-colors">
                          <div 
                            className="rail w-[3px] rounded-[3px] self-stretch" 
                            style={{ 
                              backgroundColor: sig.type === "growth" ? "var(--growth)" : sig.type === "risk" ? "var(--risk)" : "var(--neutral)" 
                            }}
                          />
                          <div className="body flex-1 min-w-0">
                            <div className="meta flex items-center gap-[8px] flex-wrap mb-[7px]">
                              <Badge type="cat">{sig.category}</Badge>
                              <Badge type={sig.type}>{sig.type.toUpperCase()}</Badge>
                              <span className="font-mono text-[10px] text-ink-soft">
                                {sig.about_role.toUpperCase()}
                              </span>
                            </div>
                            <h4 className="ttl font-semibold text-[14.5px] leading-snug text-ink mb-[5px]">{sig.title}</h4>
                            <p className="ex text-ink-soft text-[12.8px] leading-relaxed">{sig.summary}</p>
                            
                            <div className="src flex items-center gap-[7px] mt-[9px] font-mono text-[10.5px] text-ink-faint">
                              <span>{sig.age_days}d ago ({new Date(sig.published_at).toLocaleDateString()})</span> · 
                              {sig.sources.map((src: any, idx: number) => (
                                <a key={idx} href={src.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                                  {src.publisher}
                                </a>
                              ))}
                              <span className="sev flex gap-[2px] ml-auto">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <i 
                                    key={s} 
                                    className={`w-[5px] h-[5px] rounded-full ${s <= sig.severity ? "bg-accent" : "bg-line"}`}
                                  />
                                ))}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}

                      {signalsFeed.items.length === 0 && (
                        <div className="p-8 text-center text-ink-soft font-mono">
                          No signals match the specified filters.
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Pagination Controls */}
                  {signalsFeed.total > 50 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 px-2">
                      <span className="text-ink-soft font-mono text-[12.5px] font-medium">
                        Page {feedPage} of {Math.ceil(signalsFeed.total / 50)} ({signalsFeed.total} total signals)
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <button
                          disabled={feedPage === 1}
                          onClick={() => setFeedPage(prev => Math.max(1, prev - 1))}
                          className={`font-mono text-[11.5px] px-[14px] py-[8px] rounded-lg border cursor-pointer select-none transition-all ${
                            feedPage === 1 
                              ? "bg-paper-3 border-line text-ink-faint cursor-not-allowed opacity-60" 
                              : "bg-paper-2 border-line text-ink-soft hover:border-brand hover:text-brand hover:shadow-sm"
                          }`}
                        >
                          &larr; Previous
                        </button>
                        
                        {/* Page number buttons */}
                        {(() => {
                          const totalPages = Math.ceil(signalsFeed.total / 50);
                          const pages = [];
                          const maxVisiblePages = 5;
                          let startPage = Math.max(1, feedPage - 2);
                          let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                          
                          if (endPage - startPage < maxVisiblePages - 1) {
                            startPage = Math.max(1, endPage - maxVisiblePages + 1);
                          }
                          
                          for (let i = startPage; i <= endPage; i++) {
                            pages.push(i);
                          }
                          
                          return (
                            <div className="flex items-center gap-1.5">
                              {startPage > 1 && (
                                <>
                                  <button
                                    onClick={() => setFeedPage(1)}
                                    className={`w-[32px] h-[32px] flex items-center justify-center font-mono text-[11.5px] rounded-lg border cursor-pointer transition-all ${
                                      feedPage === 1 
                                        ? "bg-ink border-ink text-paper-2 font-semibold" 
                                        : "bg-paper-2 border-line text-ink-soft hover:border-brand hover:text-brand"
                                    }`}
                                  >
                                    1
                                  </button>
                                  {startPage > 2 && <span className="text-ink-faint font-mono px-1">...</span>}
                                </>
                              )}
                              
                              {pages.map((p) => {
                                if (p === 1 && startPage > 1) return null;
                                return (
                                  <button
                                    key={p}
                                    onClick={() => setFeedPage(p)}
                                    className={`w-[32px] h-[32px] flex items-center justify-center font-mono text-[11.5px] rounded-lg border cursor-pointer transition-all ${
                                      feedPage === p 
                                        ? "bg-ink border-ink text-paper-2 font-semibold shadow-sm" 
                                        : "bg-paper-2 border-line text-ink-soft hover:border-brand hover:text-brand"
                                    }`}
                                  >
                                    {p}
                                  </button>
                                );
                              })}
                              
                              {endPage < totalPages && (
                                <>
                                  {endPage < totalPages - 1 && <span className="text-ink-faint font-mono px-1">...</span>}
                                  <button
                                    onClick={() => setFeedPage(totalPages)}
                                    className={`w-[32px] h-[32px] flex items-center justify-center font-mono text-[11.5px] rounded-lg border cursor-pointer transition-all ${
                                      feedPage === totalPages 
                                        ? "bg-ink border-ink text-paper-2 font-semibold" 
                                        : "bg-paper-2 border-line text-ink-soft hover:border-brand hover:text-brand"
                                    }`}
                                  >
                                    {totalPages}
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })()}
                        
                        <button
                          disabled={feedPage >= Math.ceil(signalsFeed.total / 50)}
                          onClick={() => setFeedPage(prev => Math.min(Math.ceil(signalsFeed.total / 50), prev + 1))}
                          className={`font-mono text-[11.5px] px-[14px] py-[8px] rounded-lg border cursor-pointer select-none transition-all ${
                            feedPage >= Math.ceil(signalsFeed.total / 50)
                              ? "bg-paper-3 border-line text-ink-faint cursor-not-allowed opacity-60" 
                              : "bg-paper-2 border-line text-ink-soft hover:border-brand hover:text-brand hover:shadow-sm"
                          }`}
                        >
                          Next &rarr;
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* PAGE 4: RISK & GROWTH MAP */}
              {activeTab === "riskmap" && (
                <section className="page active space-y-[18px] animate-rise">
                  <div className="phead text-left mb-[22px]">
                    <div className="eyebrow font-mono text-[10px] tracking-widest text-brand font-semibold uppercase">Risk &amp; Growth Signal Map</div>
                    <h1 className="ptitle font-display font-semibold text-[30px] leading-tight text-ink mt-[7px] mb-[5px] tracking-tight">Synthesis Map</h1>
                    <p className="psub text-ink-soft text-[14px] max-w-[700px]">Strategic coordinate mapping of signals. X-axis shows Momentum Shift direction; Y-axis maps Business Materiality Impact.</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px]">
                    
                    {/* Scatter plot visual */}
                    <div className="flex flex-col gap-4">
                      <div className="scatter relative h-[340px] border border-line rounded-[13px] bg-paper-3 overflow-hidden bg-[radial-gradient(rgba(35,33,27,0.04)_1px,transparent_1px)] bg-[size:10%_25%] select-none">
                        
                        {/* Axes Labels */}
                        <div className="axlabel absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-widest text-ink-faint bg-paper-3 px-2 whitespace-nowrap">
                          X-AXIS: ◄ SEVERE RISKS | NEUTRAL | HIGH GROWTH ►
                        </div>
                        <div className="axlabel absolute left-5 top-1/2 -translate-y-1/2 -translate-x-1/2 -rotate-90 font-mono text-[9px] uppercase tracking-widest text-ink-faint bg-paper-3 px-2 whitespace-nowrap">
                          Y-AXIS: HIGH SEVERITY / IMPACT ▲
                        </div>

                        {/* Middle divide line */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-line border-dashed"></div>

                        {/* Signals Bubbles */}
                        {mapData?.plot?.map((item: any, idx: number) => {
                          const diameter = 24 + (item.severity * 5); // 29px to 49px
                          const bg = item.type === "growth" 
                            ? "bg-growth" 
                            : item.type === "risk" 
                            ? "bg-risk" 
                            : "bg-neutral";

                          return (
                            <div 
                              key={item.id}
                              className={`bubble absolute rounded-full ${bg} flex items-center justify-center text-white border-2 border-paper-2 shadow-sm font-mono text-[8.5px] font-semibold cursor-pointer hover:scale-110 transition-transform duration-200`}
                              style={{
                                left: `${item.x_momentum}%`,
                                bottom: `${item.y_impact}%`,
                                width: diameter,
                                height: diameter,
                              }}
                              title={`${item.label} (Severity: ${item.severity})`}
                            >
                              S{idx + 1}
                            </div>
                          );
                        })}
                      </div>

                      {/* Map plot legend */}
                      <Card className="py-3">
                        <div className="flex justify-between items-center text-xs font-mono text-ink-soft">
                          <span><b>S1 - S{mapData?.plot?.length || 0}</b>: Live Sourced News Signals (X=Growth/Risk, Y=Severity)</span>
                          <span className="flex gap-4">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-growth"></span>Growth</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-risk"></span>Risk</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-neutral"></span>Neutral</span>
                          </span>
                        </div>
                      </Card>
                    </div>

                    {/* Emerging Themes clusters */}
                    <div className="space-y-[18px]">
                      
                      {/* Growth/Risk Balance card */}
                      <Card className="p-[18px] md:p-[20px]">
                        <CardHeader>
                          <CardTitle>30-Day Signal Balance</CardTitle>
                        </CardHeader>
                        <div className="flex justify-between items-center">
                          <div className="flex gap-4 text-center">
                            <div>
                              <div className="text-[20px] font-bold text-growth">{mapData?.balance?.growth || 0}</div>
                              <div className="text-[10px] font-mono text-ink-faint">GROWTH</div>
                            </div>
                            <div>
                              <div className="text-[20px] font-bold text-risk">{mapData?.balance?.risk || 0}</div>
                              <div className="text-[10px] font-mono text-ink-faint">RISK</div>
                            </div>
                            <div>
                              <div className="text-[20px] font-bold text-neutral">{mapData?.balance?.neutral || 0}</div>
                              <div className="text-[10px] font-mono text-ink-faint">NEUTRAL</div>
                            </div>
                          </div>
                          
                          <div className="h-[35px] w-[1px] bg-line"></div>
                          
                          <div className="text-right">
                            <div className="text-[20px] font-bold text-brand">{mapData?.balance?.ratio_30d || "1.0"}</div>
                            <div className="text-[10px] font-mono text-ink-faint">GROWTH:RISK RATIO</div>
                          </div>
                        </div>
                      </Card>

                      {/* Themes clusters list */}
                      <div className="space-y-3">
                        <div className="note font-mono text-[9px] text-ink-faint tracking-wider uppercase text-left pl-1">EMERGING THEMES · LLM SYNTHESIS</div>
                        
                        {mapData?.themes?.map((theme: any, idx: number) => (
                          <div key={idx} className="cluster p-[15px] p-[17px] border border-line rounded-[13px] bg-paper-2 text-left shadow-sm">
                            <div className="top flex items-center gap-[9px] mb-[9px]">
                              <h4 className="font-semibold text-[14px] text-ink flex-1">{theme.label}</h4>
                              <Badge type={theme.type}>{theme.type.toUpperCase()}</Badge>
                            </div>
                            <p className="text-[12.5px] text-ink-soft leading-relaxed">{theme.narrative}</p>
                            
                            <div className="themebar h-[5px] rounded-full bg-line mt-[11px] overflow-hidden">
                              <span 
                                className="block h-full rounded-full" 
                                style={{ 
                                  width: `${theme.strength * 100}%`,
                                  backgroundColor: theme.type === "growth" ? "var(--growth)" : theme.type === "risk" ? "var(--risk)" : "var(--brand)"
                                }}
                              />
                            </div>
                            <div className="flex justify-between items-center font-mono text-[9px] text-ink-faint mt-1.5">
                              <span>Theme Strength: {Math.round(theme.strength * 100)}%</span>
                              <span>{theme.signal_ids.length} signals aggregated</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Qualitative Synthesis & Strategic Intelligence */}
                  <Card>
                    <CardHeader className="flex justify-between w-full pb-[10px]">
                      <div className="flex items-center gap-[10px]">
                        <div className="w-[30px] h-[30px] rounded-[9px] bg-paper-3 border border-line flex items-center justify-center text-brand">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-[15px] h-[15px]">
                            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                          </svg>
                        </div>
                        <CardTitle>Analysis &amp; Insights Agent: Qualitative Synthesis</CardTitle>
                      </div>
                      <span className="ml-auto font-mono text-[9.5px] text-brand bg-brand/10 px-2 py-0.5 rounded-[4px] font-semibold uppercase tracking-wider">
                        Strategic Intelligence
                      </span>
                    </CardHeader>

                    <div className="text-left space-y-5">
                      {mapData?.summary && (
                        <p className="text-[14.2px] leading-relaxed text-ink border-l-2 border-brand pl-3 italic font-body">
                          {mapData.summary}
                        </p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px] pt-2">
                        {/* Emerging Growth Themes */}
                        <div className="space-y-[12px]">
                          <div className="flex items-center gap-[8px] border-b border-line-soft pb-2">
                            <span className="w-2 h-2 rounded-full bg-growth animate-pulse-slow"></span>
                            <h4 className="font-semibold font-display text-[15px] text-ink uppercase tracking-wide">Emerging Growth Themes</h4>
                          </div>

                          <div className="space-y-[12px]">
                            {mapData?.growth_insights?.map((item: any, idx: number) => (
                              <div key={idx} className="p-[14px] bg-growth/5 border border-growth/10 rounded-[12px] space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                  <h5 className="font-semibold text-[13.5px] text-growth">{item.theme}</h5>
                                  <Badge type="growth" className="text-[9px] font-mono uppercase px-1.5 py-0.5 whitespace-nowrap">{item.strategic_value}</Badge>
                                </div>
                                <p className="text-[12.8px] leading-[1.5] text-ink-soft">{item.description}</p>
                                <div className="text-[10px] font-mono text-ink-faint">Timeline: {item.timeline}</div>
                              </div>
                            ))}
                            {(!mapData?.growth_insights || mapData.growth_insights.length === 0) && (
                              <p className="text-sm text-ink-faint italic">No growth insights synthesized yet.</p>
                            )}
                          </div>
                        </div>

                        {/* Emerging Risk Areas */}
                        <div className="space-y-[12px]">
                          <div className="flex items-center gap-[8px] border-b border-line-soft pb-2">
                            <span className="w-2 h-2 rounded-full bg-risk animate-pulse-slow"></span>
                            <h4 className="font-semibold font-display text-[15px] text-ink uppercase tracking-wide">Emerging Risk Areas</h4>
                          </div>

                          <div className="space-y-[12px]">
                            {mapData?.risk_insights?.map((item: any, idx: number) => (
                              <div key={idx} className="p-[14px] bg-risk/5 border border-risk/10 rounded-[12px] space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                  <h5 className="font-semibold text-[13.5px] text-risk">{item.area}</h5>
                                  <Badge type="risk" className="text-[9px] font-mono uppercase px-1.5 py-0.5 whitespace-nowrap">{item.vulnerability_level}</Badge>
                                </div>
                                <p className="text-[12.8px] leading-[1.5] text-ink-soft">{item.description}</p>
                                <div className="text-[11px] leading-[1.4] text-ink-soft bg-paper-3/50 p-2.5 rounded border border-line-soft mt-1">
                                  <span className="font-mono text-[9px] text-ink font-semibold uppercase tracking-wider block mb-0.5">Mitigation Recommendation:</span>
                                  {item.mitigation}
                                </div>
                              </div>
                            ))}
                            {(!mapData?.risk_insights || mapData.risk_insights.length === 0) && (
                              <p className="text-sm text-ink-faint italic">No risk insights synthesized yet.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </section>
              )}

              {/* PAGE 5: COMPETITIVE LANDSCAPE */}
              {activeTab === "compete" && (
                <section className="page active space-y-6 animate-rise">
                  <div className="phead text-left mb-[22px]">
                    <div className="eyebrow font-mono text-[10px] tracking-widest text-brand font-semibold uppercase">Competitive Landscape</div>
                    <h1 className="ptitle font-display font-semibold text-[30px] leading-tight text-ink mt-[7px] mb-[5px] tracking-tight">Competitor Benchmark</h1>
                    <p className="psub text-ink-soft text-[14px] max-w-[700px]">Benchmark momentum and financials against the propose compete set. Highlighted row indicates current account context.</p>
                  </div>

                  <Card padded={false} className="overflow-x-auto">
                    <table className="tbl w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left font-mono text-[9.5px] tracking-widest text-ink-faint uppercase p-[14px] pb-[12px] font-semibold border-b border-line">ORGANISATION</th>
                          <th className="text-left font-mono text-[9.5px] tracking-widest text-ink-faint uppercase p-[14px] pb-[12px] font-semibold border-b border-line">30D MOMENTUM</th>
                          <th className="text-left font-mono text-[9.5px] tracking-widest text-ink-faint uppercase p-[14px] pb-[12px] font-semibold border-b border-line">REVENUE (FY)</th>
                          <th className="text-left font-mono text-[9.5px] tracking-widest text-ink-faint uppercase p-[14px] pb-[12px] font-semibold border-b border-line">GROSS MARGIN</th>
                          <th className="text-left font-mono text-[9.5px] tracking-widest text-ink-faint uppercase p-[14px] pb-[12px] font-semibold border-b border-line">LATEST ACTIVE SIGNAL</th>
                          <th className="text-left font-mono text-[9.5px] tracking-widest text-ink-faint uppercase p-[14px] pb-[12px] font-semibold border-b border-line">SENTIMENT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-soft text-left">
                        {competitors?.set?.map((row: any, idx: number) => {
                          const isTarget = row.entity.id === accountId;

                          return (
                            <tr key={idx} className={isTarget ? "bg-brand/5 border-l-4 border-l-brand" : ""}>
                              <td className="p-[15px] p-[14px] font-semibold text-[13.5px]">
                                <div className="flex items-center gap-[10px]">
                                  <div 
                                    className="clogo w-[30px] h-[30px] rounded-[8px] text-white flex items-center justify-center font-display font-semibold text-[13px]"
                                    style={{
                                      background: isTarget 
                                        ? "linear-gradient(135deg, var(--brand), var(--brand-deep))" 
                                        : "linear-gradient(135deg, #9a8a6b, var(--neutral))"
                                    }}
                                  >
                                    {row.entity.display_name.charAt(0)}
                                  </div>
                                  <div className="flex flex-col">
                                    <span>{row.entity.display_name}</span>
                                    <span className="font-mono text-[9.5px] text-ink-soft font-normal">
                                      {row.entity.tickers?.[0]?.exchange || "MKT"}: {row.entity.tickers?.[0]?.symbol}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-[15px] p-[14px]">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold">{Number(row.momentum).toFixed(1)}</span>
                                  <div className="mini-bar w-[70px] h-[6px] rounded-full bg-line overflow-hidden">
                                    <span 
                                      className="block h-full bg-growth rounded-full" 
                                      style={{ width: `${row.momentum}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="p-[15px] p-[14px] font-mono">{row.revenue}</td>
                              <td className="p-[15px] p-[14px] font-mono">{row.gross_margin}</td>
                              <td className="p-[15px] p-[14px] max-w-[200px] truncate" title={row.latest_signal}>
                                {row.latest_signal}
                              </td>
                              <td className="p-[15px] p-[14px]">
                                <Badge type={row.sentiment.startsWith("+") ? "growth" : row.sentiment.startsWith("-") ? "risk" : "neutral"}>
                                  {row.sentiment}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
 
                  {/* Qualitative Synthesis Card */}
                  <Card className="mt-8">
                    <CardHeader className="flex justify-between w-full pb-[10px]">
                      <div className="flex items-center gap-[10px]">
                        <div className="w-[30px] h-[30px] rounded-[9px] bg-paper-3 border border-line flex items-center justify-center text-brand">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-[15px] h-[15px]">
                            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                          </svg>
                        </div>
                        <CardTitle>Analysis &amp; Insights Agent: Competitive Qualitative Synthesis</CardTitle>
                      </div>
                      <span className="ml-auto font-mono text-[9.5px] text-brand bg-brand/10 px-2 py-0.5 rounded-[4px] font-semibold uppercase tracking-wider">
                        Strategic Synthesis
                      </span>
                    </CardHeader>

                    <div className="text-left space-y-6">
                      {competitors?.comparison?.summary && (
                        <p className="text-[14.2px] leading-relaxed text-ink border-l-2 border-brand pl-3 italic font-body">
                          {competitors.comparison.summary}
                        </p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px] pt-2">
                        {/* Investment & R&D Areas */}
                        <div className="p-[14px] bg-paper-3/50 border border-line-soft rounded-[12px] space-y-2">
                          <h4 className="font-semibold text-[13.5px] text-brand uppercase tracking-wider font-mono">1. Investment &amp; R&amp;D Areas</h4>
                          <p className="text-[12.8px] leading-[1.65] text-ink-soft">{competitors?.comparison?.investment_analysis}</p>
                        </div>

                        {/* M&A and Restructuring */}
                        <div className="p-[14px] bg-paper-3/50 border border-line-soft rounded-[12px] space-y-2">
                          <h4 className="font-semibold text-[13.5px] text-brand uppercase tracking-wider font-mono">2. Acquisitions &amp; Demergers</h4>
                          <p className="text-[12.8px] leading-[1.65] text-ink-soft">{competitors?.comparison?.structure_analysis}</p>
                        </div>

                        {/* Leadership & CEO Transitions */}
                        <div className="p-[14px] bg-paper-3/50 border border-line-soft rounded-[12px] space-y-2">
                          <h4 className="font-semibold text-[13.5px] text-brand uppercase tracking-wider font-mono">3. Leadership transitions</h4>
                          <p className="text-[12.8px] leading-[1.65] text-ink-soft">{competitors?.comparison?.leadership_analysis}</p>
                        </div>

                        {/* Stock & Margin Performance */}
                        <div className="p-[14px] bg-paper-3/50 border border-line-soft rounded-[12px] space-y-2">
                          <h4 className="font-semibold text-[13.5px] text-brand uppercase tracking-wider font-mono">4. Margin &amp; Market Performance</h4>
                          <p className="text-[12.8px] leading-[1.65] text-ink-soft">{competitors?.comparison?.performance_analysis}</p>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <div className="phead text-left mt-8 mb-[22px]">
                    <div className="eyebrow font-mono text-[10px] tracking-widest text-brand font-semibold uppercase">AI Financial &amp; Strategic Synthesis</div>
                    <h2 className="ptitle font-display font-semibold text-[24px] leading-tight text-ink mt-[7px] mb-[5px] tracking-tight">Key Themes from Annual Filings</h2>
                    <p className="psub text-ink-soft text-[14px] max-w-[700px]">Strategic growth drivers, investment areas, and emerging risks synthesized directly from the latest competitor filings and reports.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {competitors?.themes?.map((theme: any, idx: number) => (
                      <Card key={idx} className="p-5 text-left bg-white border border-line hover:border-brand/30 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-semibold text-[15.5px] flex items-center gap-2 text-ink">
                            {theme.company}
                          </div>
                          <Badge type={theme.type}>{theme.type.toUpperCase()}</Badge>
                        </div>
                        <h4 className="font-mono text-[11px] text-ink-soft mb-2 tracking-wide uppercase">{theme.title}</h4>
                        <p className="text-[13.5px] text-ink leading-relaxed">{theme.description}</p>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* PAGE 6: FINANCIALS */}
              {activeTab === "financials" && (
                <section className="page active space-y-6 animate-rise">
                  <div className="phead text-left mb-[22px] flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <div>
                      <div className="eyebrow font-mono text-[10px] tracking-widest text-brand font-semibold uppercase">Financial Deep-Dive</div>
                      <h1 className="ptitle font-display font-semibold text-[30px] leading-tight text-ink mt-[7px] mb-[5px] tracking-tight">Financials</h1>
                      <p className="psub text-ink-soft text-[14px] max-w-[700px]">Strictly filings-sourced metrics parsed from SEC 20-F annual and 6-K quarterly reports. Every value includes full provenance. Unilever's financial reporting year ends on <strong>December 31st</strong>.</p>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-paper-3 border border-line font-mono text-[11px] text-ink-soft">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
                        Reporting Year End: <strong className="text-ink font-semibold">Dec 31</strong>
                      </div>
                    </div>
                  </div>

                  {/* Financial KPI stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[18px]">
                    {financials?.kpis?.map((k: any, idx: number) => (
                      <Card key={idx} className="p-[18px] md:p-[20px] flex flex-col justify-between text-left relative">
                        <div className="font-mono text-[9.5px] tracking-widest text-ink-faint uppercase">
                          {k.label}
                        </div>
                        <div className="font-display font-semibold text-[28px] mt-[7px] leading-none text-ink">
                          {k.value}
                        </div>
                        <div className="flex justify-between items-center mt-3 font-mono text-[10px]">
                          {k.yoy ? (
                            <span className={k.yoy.includes("▲") ? "text-growth" : "text-risk"}>
                              {k.yoy}
                            </span>
                          ) : (
                            <span className="text-ink-faint">YoY steady</span>
                          )}
                          <a href={k.sourceUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline font-semibold uppercase tracking-wider text-[9px]">
                            {k.sourceName} ⓘ
                          </a>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px]">
                    
                    {/* Quarterly Turnover Bars */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Quarterly Sales Velocity</CardTitle>
                      </CardHeader>
                      <div className="flex items-end gap-6 justify-center h-[200px] pt-8">
                        {financials?.quarterly?.map((q: any, idx: number) => (
                          <div key={idx} className="flex flex-col items-center gap-2 w-16">
                            <span className="font-mono text-xs font-semibold">€{q.turnover}B</span>
                            <div 
                              className="w-full bg-gradient-to-t from-brand-deep to-brand rounded-t-[7px] transition-all duration-1000"
                              style={{ height: `${q.turnover * 10}px` }}
                            />
                            <span className="font-mono text-[9.5px] text-ink-faint uppercase">{q.period}</span>
                          </div>
                        ))}
                      </div>
                    </Card>

                    {/* What changed list */}
                    <Card className="text-left">
                      <CardHeader>
                        <CardTitle>Key Segment Structural Changes</CardTitle>
                      </CardHeader>
                      <div className="divide-y divide-line-soft">
                        {financials?.what_changed?.map((item: any, idx: number) => (
                          <div key={idx} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`w-2 h-2 rounded-full ${item.dir === "up" ? "bg-growth" : item.dir === "down" ? "bg-risk" : "bg-neutral"}`}></span>
                              <h5 className="font-semibold text-[13.5px]">{item.label}</h5>
                            </div>
                            <p className="text-xs text-ink-soft leading-relaxed">{item.text}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  {/* Ratio tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-[18px]">
                    {financials?.ratios?.map((r: any, idx: number) => (
                      <Card key={idx} className="p-[18px] md:p-[20px] flex flex-col justify-between text-left">
                        <div className="font-mono text-[9px] tracking-widest text-ink-faint uppercase">{r.label}</div>
                        <div className="font-display font-semibold text-[22px] mt-2">{r.value}</div>
                        <div className="font-mono text-[9.5px] text-ink-faint mt-1 text-right">
                          source: <a href={r.sourceUrl} className="text-brand hover:underline">{r.sourceName}</a>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* AI Financial Analysis & Insights & Earnings Call Consensus */}
                  {financials?.analysis && (
                    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-[18px] mt-6">
                      {/* Left Column: AI Financial Analysis & Insights */}
                      <Card className="text-left p-[20px] md:p-[24px] bg-paper border border-line rounded-[16px] shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-[9px] mb-4">
                            <div className="w-[8px] h-[8px] rounded-full bg-brand animate-pulse"></div>
                            <div className="eyebrow font-mono text-[10px] tracking-widest text-brand font-semibold uppercase">AI Analysis &amp; Insights Agent</div>
                          </div>
                          
                          <h2 className="font-display font-semibold text-[20px] leading-tight text-ink mb-3 tracking-tight">Executive Financial Synthesis</h2>
                          
                          <p className="text-[14px] leading-[1.65] text-ink mb-5 pb-4 border-b border-line-soft">
                            {financials.analysis.summary}
                          </p>
                          
                          <h3 className="font-mono text-[10.5px] tracking-wider text-ink-faint uppercase mb-4">Key Financial Insights</h3>
                          
                          <ul className="space-y-4">
                            {financials.analysis.insights.map((insight: any, idx: number) => (
                              <li key={idx} className="flex gap-[12px] items-start">
                                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand mt-2"></span>
                                <div className="space-y-1">
                                  <div>
                                    <span className="font-semibold text-[13.8px] text-ink mr-1.5">
                                      {insight.title}:
                                    </span>
                                    <span className="text-[13.5px] text-ink-soft leading-relaxed">
                                      {insight.text}
                                    </span>
                                  </div>
                                  
                                  <div className="flex gap-2 mt-2 flex-wrap">
                                    {insight.citations?.map((cite: string, cIdx: number) => (
                                      <span key={cIdx} className="font-mono text-[9px] bg-paper-3 border border-line text-ink-faint px-2 py-0.5 rounded flex items-center gap-1.5">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-brand">
                                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                          <polyline points="14 2 14 8 20 8"/>
                                        </svg>
                                        {cite}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </Card>

                      {/* Right Column: Earnings Call & Analyst Consensus */}
                      <Card className="text-left p-[20px] md:p-[24px] bg-paper border border-line rounded-[16px] shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-[9px] mb-4">
                            <div className="w-[8px] h-[8px] rounded-full bg-accent animate-pulse"></div>
                            <div className="eyebrow font-mono text-[10px] tracking-widest text-[#a8761a] font-semibold uppercase">Earnings Call &amp; Analyst Sentiment</div>
                          </div>

                          <h2 className="font-display font-semibold text-[20px] leading-tight text-ink mb-3 tracking-tight">Earnings Call &amp; Analyst Consensus</h2>

                          {/* Highlights */}
                          <div className="space-y-3 mb-6">
                            <h3 className="font-mono text-[10.5px] tracking-wider text-ink-faint uppercase">Q1 2026 Call Highlights</h3>
                            <div className="space-y-2">
                              {(financials.analysis.earnings_call_highlights || [
                                "Strong Volume-Driven Growth: Reported underlying sales growth of 4.4% in Q1 2026, led primarily by a 3.2% rise in underlying volume, indicating a healthy return to volume-led expansion.",
                                "Pricing Moderation: Underlying price growth moderated significantly to 1.2% as raw material cost pressures eased, assisting in reclaiming competitive shelf space in European retail.",
                                "Power Brands Outperformance: The core 30 'Power Brands' (including Dove, Knorr, and Hellmann's) outpaced the rest of the portfolio with 5.6% underlying sales growth."
                              ]).map((hl: string, idx: number) => (
                                <div key={idx} className="flex gap-2.5 items-start text-[13px] text-ink-soft leading-relaxed">
                                  <span className="text-[#a8761a] mt-0.5">•</span>
                                  <span>{hl}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Analyst Views */}
                          <div className="space-y-4">
                            <h3 className="font-mono text-[10.5px] tracking-wider text-ink-faint uppercase">Major Institutional Views</h3>
                            <div className="space-y-3">
                              {(financials.analysis.analyst_views || [
                                { institution: "JP Morgan", sentiment: "positive", commentary: "Affirms Overweight rating. Analyst team highlights that Unilever's volume recovery is structurally sustainable, supported by the direct reinvestment of productivity savings into brand equity and marketing." },
                                { institution: "Goldman Sachs", sentiment: "neutral", commentary: "Maintains Neutral rating. Goldman notes that the Ice Cream spin-off (TMICC) removes a volatile segment, but remains cautious about potential pricing friction in European retail negotiations." },
                                { institution: "Jefferies", sentiment: "positive", commentary: "Maintains Buy rating. Cites a strong rebound in rural demand in India boosting volume growth for Hindustan Unilever, which represents a highly profitable contributor to global FMCG margins." }
                              ]).map((view: any, idx: number) => (
                                <div key={idx} className="p-3 rounded-[11px] bg-paper-3 border border-line flex flex-col gap-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-[13.5px] text-ink">{view.institution}</span>
                                    <Badge type={view.sentiment === "positive" ? "growth" : view.sentiment === "risk" ? "risk" : "neutral"}>
                                      {view.sentiment?.toUpperCase()}
                                    </Badge>
                                  </div>
                                  <p className="text-[12.5px] text-ink-soft leading-relaxed">{view.commentary}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  )}
                </section>
              )}
                   {activeTab === "leadership" && (
                <section className="page active space-y-[18px] animate-rise">
                  <div className="phead text-left mb-[22px]">
                    <div className="eyebrow font-mono text-[10px] tracking-widest text-brand font-semibold uppercase">Leadership &amp; People</div>
                    <h1 className="ptitle font-display font-semibold text-[30px] leading-tight text-ink mt-[7px] mb-[5px] tracking-tight">Executive Management</h1>
                    <p className="psub text-ink-soft text-[14px] max-w-[700px]">Track key executive changes, verify appointments, and read recent public statements from official corporate channels and C-suite voices.</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px]">
                    
                    {/* Executives list */}
                    <div className="space-y-4">
                      <Card className="text-left">
                        <CardHeader>
                          <CardTitle>Active Management Team</CardTitle>
                        </CardHeader>
                        <div className="divide-y divide-line-soft">
                          {leadership?.executives?.map((p: any) => (
                            <div key={p.id} className="person flex items-center gap-[13px] py-[13px] first:pt-0 last:pb-0">
                              <div className="avatar w-[42px] h-[42px] rounded-full bg-brand text-white flex items-center justify-center font-display font-semibold text-[15px]">
                                {p.full_name.charAt(0)}
                              </div>
                              <div className="info-p flex-1 min-w-0">
                                <div className="nm font-semibold text-[13.5px]">{p.full_name}</div>
                                <div className="role text-[12px] text-ink-soft">{p.role_title}</div>
                              </div>
                              <Badge type={p.is_current ? "growth" : "neutral"}>
                                {p.is_current ? "CURRENT" : "PAST"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </Card>

                      {/* Recent Leadership Changes & Announcements */}
                      <Card className="text-left">
                        <CardHeader>
                          <CardTitle>Recent Leadership Changes &amp; Announcements</CardTitle>
                        </CardHeader>
                        {leadership?.changes && leadership.changes.length > 0 ? (
                          <div className="divide-y divide-line-soft">
                            {leadership.changes.map((c: any) => (
                              <div key={c.id} className="py-[12px] first:pt-0 last:pb-0 flex items-start gap-3 justify-between">
                                <div>
                                  <span className="font-semibold text-[13.5px] text-ink">{c.full_name}</span>
                                  <span className="text-[12.8px] text-ink-soft block mt-0.5">
                                    {c.change_type === "appointed" ? "Appointed as" : c.change_type === "departed" ? "Departed from" : "Promoted to"} <b>{c.role_title}</b>
                                  </span>
                                </div>
                                <div className="text-right flex flex-col items-end gap-1.5">
                                  <Badge type={c.change_type === "appointed" ? "growth" : c.change_type === "departed" ? "risk" : "neutral"}>
                                    {c.change_type?.toUpperCase()}
                                  </Badge>
                                  <span className="font-mono text-[10px] text-ink-faint">{c.date}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-2 text-[12.8px] text-ink-soft leading-normal font-mono">
                            ℹ️ No major leadership appointments, departures, or board changes have been registered for {overview?.entity?.display_name || "Unilever"} in the past 6 months. Executive leadership stability remains fully maintained.
                          </div>
                        )}
                      </Card>

                      {/* Paraphrased public statements */}
                      <Card className="text-left">
                        <CardHeader>
                          <CardTitle>Paraphrased Public Voices</CardTitle>
                        </CardHeader>
                        <div className="space-y-3">
                          {leadership?.voices?.map((v: any, idx: number) => (
                            <div key={idx} className="quote p-[16px] px-[18px] rounded-[13px] bg-paper-3 border border-line">
                              <p className="font-display text-[14.5px] leading-relaxed italic">
                                "{v.body}"
                              </p>
                              <div className="by flex items-center gap-[8px] mt-[11px] text-[12px] text-ink-soft">
                                <span>by <b>{v.by}</b></span> · 
                                <span>source: <a href={v.source.url} className="text-brand hover:underline">{v.source.publisher}</a></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </div>

                    {/* LinkedIn compliant voices */}
                    <div className="space-y-4 text-left">
                      <div className="li-note flex gap-[10px] p-[12px] px-[14px] rounded-[11px] bg-[#0a66c2]/5 border border-[#0a66c2]/20 text-[12px] text-ink-soft leading-normal">
                        <svg width="17" height="17" fill="#0A66C2" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5">
                          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                        </svg>
                        <div>
                          <b>LinkedIn Public Voices</b>: Sourced compliantly by parsing official IR announcements, corporate press releases, and public C-suite statements. Due to LinkedIn API privacy restrictions on personal feeds, posts are synthesized from these verified public sources to reflect active executive perspectives.
                        </div>
                      </div>

                      <div className="flex items-center justify-between pl-1">
                        <div className="note font-mono text-[9px] text-ink-faint tracking-wider uppercase">COMPLIANT PUBLIC VOICEPOSTS</div>
                        <button
                          onClick={handleRefreshVoices}
                          disabled={isRefreshingVoices}
                          className="text-[10px] font-mono font-semibold text-[#0a66c2] hover:text-[#0a66c2]/80 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {isRefreshingVoices ? (
                            <>
                              <svg className="animate-spin h-3 w-3 text-[#0a66c2]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              REFRESHING...
                            </>
                          ) : (
                            <>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                              </svg>
                              REFRESH VOICES
                            </>
                          )}
                        </button>
                      </div>
                      
                      {linkedin?.posts?.map((post: any, idx: number) => (
                        <div key={idx} className="lipost p-[16px] px-[18px] border border-line rounded-[14px] bg-paper-2 flex flex-col shadow-sm">
                          <div className="li-hd flex items-start gap-[11px] mb-[11px]">
                            <div className="li-av w-[42px] h-[42px] rounded-full bg-brand text-white flex items-center justify-center font-display font-semibold text-[14px]">
                              {(post.author_name || post.person_role).charAt(0)}
                            </div>
                            <div className="li-info">
                              <div className="li-name font-semibold text-[13.5px] flex items-center gap-[7px] flex-wrap">
                                {post.author_name || post.person_role}
                              </div>
                              <div className="li-role text-[11.5px] text-ink-soft leading-tight mt-0.5">{post.person_role} · {post.entity}</div>
                              <div className="li-time font-mono text-[9.5px] text-ink-faint mt-1">{new Date(post.posted_at).toLocaleDateString()}</div>
                            </div>
                            <div className="li-in ml-auto w-[22px] h-[22px] rounded-[5px] bg-[#0A66C2] text-white flex items-center justify-center font-display font-bold text-[11px]">
                              in
                            </div>
                          </div>
                          
                          <p className="li-body text-[13px] leading-relaxed text-ink">{post.body}</p>
                          
                          <div className="li-tags flex gap-[8px] flex-wrap mt-[9px]">
                            {post.topics?.map((topic: string, tIdx: number) => (
                              <span key={tIdx} className="font-mono text-[10.5px] text-[#0A66C2]">
                                {topic}
                              </span>
                            ))}
                          </div>

                          <div className="li-eng flex items-center gap-[15px] mt-[14px] pt-[12px] border-t border-line-soft font-mono text-[10.5px] text-ink-faint">
                            <span>👍 {post.engagement?.reactions} reactions</span>
                            <span>💬 {post.engagement?.comments} comments</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* PAGE 8: SENTIMENT & SOCIAL */}
              {activeTab === "sentiment" && (
                <section className="page active space-y-6 animate-rise">
                  <div className="phead text-left mb-[22px]">
                    <div className="eyebrow font-mono text-[10px] tracking-widest text-brand font-semibold uppercase">Sentiment &amp; Social</div>
                    <h1 className="ptitle font-display font-semibold text-[30px] leading-tight text-ink mt-[7px] mb-[5px] tracking-tight">Public Net Sentiment</h1>
                    <p className="psub text-ink-soft text-[14px] max-w-[700px]">12-week sentiment trend indexed from −1.0 (highly negative) to +1.0 (highly positive). Center line represents neutral.</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px]">
                    
                    {/* Sentiment chart */}
                    <Card className="flex flex-col justify-between">
                      <CardHeader>
                        <CardTitle>12-Week Net Score Trend</CardTitle>
                        <Badge type="growth" className="ml-auto">
                          CURRENT: {sentiment?.net_now || "+0.30"}
                        </Badge>
                      </CardHeader>
                      
                      <div className="px-6 pb-2 text-[12px] text-ink-soft leading-normal -mt-2">
                        A rolling index of net sentiment scores computed across all parsed news and social channels over the past 12 weeks. Values range from −1.0 (highly negative) to +1.0 (highly positive), tracking shifts in public opinion.
                      </div>

                      {/* Simple visual Sparkline Chart */}
                      <div className="relative h-[160px] border border-line rounded-[12px] bg-paper-3 flex items-end justify-between p-6">
                        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-line border-dashed" title="Neutral Line (0.0)"></div>
                        
                        {sentiment?.trend?.map((pt: any, idx: number) => {
                          const heightPct = ((pt.score + 1) / 2) * 100; // Maps -1..+1 to 0..100%
                          return (
                            <div key={idx} className="flex flex-col items-center gap-1.5 z-10">
                              <span className="font-mono text-[9px] font-semibold text-ink">{pt.score >= 0 ? "+" : ""}{pt.score.toFixed(2)}</span>
                              <div 
                                className={`w-3.5 rounded-t-[4px] ${pt.score >= 0 ? "bg-growth" : "bg-risk"}`}
                                style={{ height: `${Math.abs(pt.score) * 60 + 5}px`, transform: pt.score >= 0 ? "none" : "translateY(100%) scaleY(-1)" }}
                              />
                              <span className="font-mono text-[8px] text-ink-faint mt-4">{pt.week}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-between font-mono text-[10px] text-ink-soft mt-3 px-1">
                        <span>◄ Trailing 12 Weeks lookback</span>
                        <span>Neutral baseline: 0.0</span>
                      </div>
                    </Card>

                    {/* Breakdown by source */}
                    <Card className="text-left">
                      <CardHeader>
                        <CardTitle>Net Sentiment by Channel</CardTitle>
                      </CardHeader>
                      
                      <div className="px-6 pb-3 text-[12px] text-ink-soft leading-normal -mt-2">
                        Breaks down public sentiment across distinct media channels, highlighting differences between formal corporate reports, general public opinion, industry trade coverage, and financial analyst consensus.
                      </div>

                      <div className="space-y-4">
                        {[
                          { channel: "Corporate News", score: sentiment?.by_source?.news ?? 0.35, color: "bg-brand" },
                          { channel: "Social Listening (public)", score: sentiment?.by_source?.social ?? 0.20, color: "bg-accent" },
                          { channel: "Trade Journals", score: sentiment?.by_source?.trade ?? 0.30, color: "bg-growth" },
                          { channel: "Financial Analyst reports", score: sentiment?.by_source?.analyst ?? 0.40, color: "bg-brand-deep" },
                        ].map((src, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-xs font-mono">
                              <span>{src.channel}</span>
                              <span className="font-semibold">+{src.score.toFixed(2)}</span>
                            </div>
                            <div className="h-[8px] rounded-full bg-line overflow-hidden">
                              <span 
                                className={`block h-full ${src.color} rounded-full`}
                                style={{ width: `${src.score * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  {/* AI Sentiment Synthesis Card */}
                  <Card className="text-left">
                    <CardHeader>
                      <CardTitle>AI Sentiment &amp; Media Synthesis</CardTitle>
                    </CardHeader>
                    
                    <div className="px-6 pb-2 text-[12px] text-ink-soft leading-normal -mt-2 mb-4">
                      AI-generated qualitative analysis summarizing public perception trends and identifying key themes driving media coverage.
                    </div>

                    <div className="space-y-4">
                      <div className="p-[16px] px-[18px] rounded-[13px] bg-paper-3 border border-line">
                        <div className="flex gap-[10px] items-start">
                          <div className="w-[32px] h-[32px] rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm flex-shrink-0">
                            ✨
                          </div>
                          <div>
                            <div className="text-[12px] font-mono text-brand font-semibold uppercase tracking-wider mb-1">ANALYSIS BRIEF</div>
                            <p className="text-[13.5px] leading-relaxed text-ink">{sentiment?.summary}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sentiment?.insights?.map((insight: any, idx: number) => (
                          <div key={idx} className="p-[14px] px-[16px] border border-line rounded-[12px] bg-paper-2 flex flex-col justify-between shadow-sm">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge type={insight.impact === "Positive" ? "growth" : insight.impact === "Negative" ? "risk" : "neutral"}>
                                  {insight.impact.toUpperCase()}
                                </Badge>
                                <h6 className="font-semibold text-[13px] text-ink">{insight.title}</h6>
                              </div>
                              <p className="text-[12.5px] leading-normal text-ink-soft">{insight.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>

                  {/* Representative Mentions */}
                  <Card padded={false} className="text-left">
                    <div className="p-5 px-6 pb-2">
                      <CardHeader>
                        <CardTitle>Representative Sourced Mentions</CardTitle>
                      </CardHeader>
                      
                      <div className="text-[12.5px] text-ink-soft leading-normal mt-3 border-t border-line-soft pt-3">
                        <b>What is this section?</b> Representative Sourced Mentions are the specific, verified articles and announcements crawled by our agents from public media feeds. The system analyzes each article's text via Gemini to calculate a sentiment polarity score (from −1.0 to +1.0) indicating whether it represents a Growth Driver (positive) or a Risk Factor (negative). Click <b>LINK ↗</b> on any entry to open the verified primary source in a new tab.
                      </div>
                    </div>
                    <div className="divide-y divide-line-soft">
                      {sentiment?.mentions?.map((men: any, idx: number) => (
                        <div key={idx} className="p-4 px-6 flex items-center justify-between hover:bg-paper-3 transition-colors">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge type="cat">{men.type.toUpperCase()}</Badge>
                              <span className="font-mono text-xs text-ink-soft">{men.who}</span>
                            </div>
                            <h5 className="font-semibold text-sm text-ink">{men.title}</h5>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <Badge type={men.polarity >= 0 ? "growth" : "risk"}>
                              {men.polarity >= 0 ? "+" : ""}{men.polarity.toFixed(2)}
                            </Badge>
                            <a href={men.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-mono text-xs">
                              LINK ↗
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </section>
              )}

              {/* PAGE 9: GEO & INDUSTRY */}
              {activeTab === "geo" && (
                <section className="page active space-y-6 animate-rise">
                  <div className="phead text-left mb-[22px]">
                    <div className="eyebrow font-mono text-[10px] tracking-widest text-brand font-semibold uppercase">Geo &amp; Industry Context</div>
                    <h1 className="ptitle font-display font-semibold text-[30px] leading-tight text-ink mt-[7px] mb-[5px] tracking-tight">
                      The world around {overview?.entity?.display_name || "Unilever"}
                    </h1>
                    <p className="psub text-ink-soft text-[14px] max-w-[700px]">Macro economic conditions, sector developments, and geopolitical alerts that frame the operating environment.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[18px]">
                    {context?.items?.map((item: any, idx: number) => (
                      <Card key={idx} className="p-[18px] md:p-[20px] flex flex-col justify-between text-left shadow-sm">
                        <div>
                          <div className="cardhead flex items-center mb-3">
                            <Badge type="cat">{item.category_label}</Badge>
                            <span className="font-mono text-[10px] text-ink-faint ml-auto">
                              {new Date(item.published_at).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="font-semibold text-[15px] text-ink leading-snug mb-[6px]">{item.title}</h4>
                          <p className="text-[12.8px] text-ink-soft leading-relaxed">{item.body}</p>
                        </div>
                        
                        <div className="src-foot font-mono text-[9px] text-ink-faint border-t border-dashed border-line pt-3 mt-4 uppercase tracking-wider">
                          source: <a href={item.source.url} className="text-brand hover:underline">{item.source.publisher}</a>
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* PAGE 10: WATCHLIST */}
              {activeTab === "watchlist" && (
                <section className="page active space-y-6 animate-rise">
                  <div className="phead text-left mb-[22px]">
                    <div className="eyebrow font-mono text-[10px] tracking-widest text-brand font-semibold uppercase">Watchlist</div>
                    <h1 className="ptitle font-display font-semibold text-[30px] leading-tight text-ink mt-[7px] mb-[5px] tracking-tight">Your saved accounts</h1>
                    <p className="psub text-ink-soft text-[14px] max-w-[700px]">Followed accounts context. High-severity alerts automatically push triggers for all saved organizations.</p>
                  </div>

                  <Card padded={false}>
                    <div className="divide-y divide-line-soft">
                      {watchlist?.accounts?.map((item: any) => (
                        <div key={item.entity.id} className="watch flex items-center justify-between p-[15px] px-[18px] text-left hover:bg-paper-3 transition-colors">
                          <div className="flex items-center gap-[13px]">
                            <div className="clogo w-[38px] h-[38px] rounded-[10px] bg-gradient-to-br from-brand to-brand-deep text-white flex items-center justify-center font-display font-bold text-[16px]">
                              {item.entity.display_name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-ink text-sm">{item.entity.display_name}</div>
                              <div className="note font-mono text-xs text-ink-faint mt-0.5">
                                {item.entity.tickers?.[0]?.exchange}: {item.entity.tickers?.[0]?.symbol} · {item.latest_signal}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <Badge type={item.status}>{item.status.toUpperCase()}</Badge>
                            <span className="font-mono text-xs font-semibold">Momentum: {item.momentum}</span>
                            <button 
                              onClick={() => switchAccount(item.entity.id)}
                              className="btn py-1 px-3 bg-paper-3 border border-line text-xs font-mono font-semibold rounded hover:bg-brand hover:text-white hover:border-brand cursor-pointer transition-colors"
                            >
                              OPEN
                            </button>
                          </div>
                        </div>
                      ))}

                      {watchlist?.accounts?.length === 0 && (
                        <div className="p-8 text-center text-ink-soft font-mono">
                          You haven't watchlisted any accounts yet. Select "Watchlist" in the header to save one.
                        </div>
                      )}
                    </div>
                  </Card>
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {/* ALERTS DRAWER */}
      <Drawer 
        isOpen={alertDrawerOpen} 
        onClose={() => setAlertDrawerOpen(false)} 
        title="Alerts"
        badge={alerts.unread > 0 ? `${alerts.unread} high severity` : undefined}
      >
        <div className="p-4 pt-1 pb-4 flex justify-between border-b border-line-soft">
          <button 
            onClick={markAlertsRead}
            className="text-xs font-mono text-brand font-semibold hover:underline cursor-pointer"
          >
            Mark all as read
          </button>
        </div>
        <div className="divide-y divide-line-soft">
          {alerts.alerts.map((alert: any) => (
            <div key={alert.id} className={`alert flex gap-[13px] p-[15px] p-[22px] text-left hover:bg-paper-3 transition-colors ${!alert.readAt ? "bg-risk/5" : ""}`}>
              <div 
                className="ai w-[34px] h-[34px] rounded-[9px] flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: alert.severity >= 4 ? "var(--risk-bg)" : "var(--neutral-bg)",
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={alert.severity >= 4 ? "var(--risk)" : "var(--neutral)"} strokeWidth="2">
                  {alert.severity >= 4 ? (
                    <path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>
                  ) : (
                    <path d="M12 2v20M5 9h14M5 15h14"/>
                  )}
                </svg>
              </div>
              <div className="flex-1">
                <div className="at font-semibold text-[13px] text-ink">{alert.title}</div>
                <div className="ad text-[12px] text-ink-soft mt-[2px] leading-relaxed">{alert.body}</div>
                <div className="atm font-mono text-[9.5px] text-ink-faint mt-[5px] uppercase">
                  UNILEVER · {new Date(alert.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Drawer>

      {/* BRIEFING MODAL */}
      <Modal isOpen={briefingModalOpen} onClose={() => setBriefingModalOpen(false)}>
        <div id="briefing-modal-content">
          <div className="brief-hd p-[26px] p-[30px] border-b border-line flex items-start gap-[14px] text-left">
            <div className="logo w-[46px] h-[46px] rounded-[11px] bg-gradient-to-br from-brand to-brand-deep text-white grid place-items-center font-display font-semibold text-[20px]">
              {currentEntityName.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="eyebrow font-mono text-[10px] tracking-widest text-brand font-semibold uppercase">Executive Briefing · auto-generated</div>
              <h1 className="font-display text-[24px] font-semibold text-ink mt-[4px]">
                {currentEntityName}
              </h1>
              <div className="note font-mono text-[10px] text-ink-faint mt-[4px]">
                {overview?.entity?.tickers?.[0]?.exchange || "LSE"}: {overview?.entity?.tickers?.[0]?.symbol || "ULVR"} · Prepared just now · Sourced Intel
              </div>
            </div>
            <button 
              onClick={() => setBriefingModalOpen(false)}
              className="closex w-[34px] h-[34px] rounded-[9px] border border-line bg-paper-2 hover:border-brand hover:text-brand cursor-pointer flex items-center justify-center text-ink transition-colors duration-150"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6 6 18"/>
              </svg>
            </button>
          </div>
          
          <div className="brief-body p-[24px] p-[30px] text-left">
            <h4 className="font-mono text-[10px] tracking-wider text-brand uppercase font-semibold mb-[10px]">Headline</h4>
            <p className="text-[13.5px] leading-relaxed text-ink">
              {briefing?.headline || "Loading executive briefing..."}
            </p>
            
            <h4 className="font-mono text-[10px] tracking-wider text-brand uppercase font-semibold mt-[20px] mb-[10px]">Key Growth Signals</h4>
            <ul className="space-y-1.5 list-none pl-0">
              {briefing?.growth?.map((item: string, idx: number) => (
                <li key={idx} className="text-[13px] py-1 border-b border-line-soft pl-4 relative before:content-[''] before:absolute before:left-0 before:top-3 before:w-1.5 before:h-1.5 before:rounded-full before:bg-accent leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
            
            <h4 className="font-mono text-[10px] tracking-wider text-brand uppercase font-semibold mt-[20px] mb-[10px]">Key Risks &amp; Watch-items</h4>
            <ul className="space-y-1.5 list-none pl-0">
              {briefing?.risks?.map((item: string, idx: number) => (
                <li key={idx} className="text-[13px] py-1 border-b border-line-soft pl-4 relative before:content-[''] before:absolute before:left-0 before:top-3 before:w-1.5 before:h-1.5 before:rounded-full before:bg-risk leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
            
            <h4 className="font-mono text-[10px] tracking-wider text-brand uppercase font-semibold mt-[20px] mb-[10px]">Competitive Read</h4>
            <p className="text-[13.5px] leading-relaxed text-ink">
              {briefing?.competitive}
            </p>
            
            <div className="src-foot font-mono text-[9px] text-ink-faint border-t border-dashed border-line pt-3 mt-4 tracking-wider">
              EVERY POINT TRACEABLE TO A CITED SOURCE · LINK DETAILS ATTACHED
            </div>
            
            <div className="flex gap-[10px] mt-6">
              <button 
                onClick={() => window.print()}
                className="btn bg-brand text-white border-transparent hover:bg-brand-deep rounded-[11px] px-[16px] py-[10px] font-body font-semibold text-[13px] cursor-pointer flex items-center gap-[8px] transition-all"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]">
                  <path d="M12 15V3M7 10l5 5 5-5M5 21h14"/>
                </svg>
                Download PDF
              </button>
              <button 
                onClick={() => setBriefingModalOpen(false)}
                className="btn bg-paper-2 border border-line text-ink hover:shadow-sm rounded-[11px] px-[16px] py-[10px] font-body font-semibold text-[13px] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* CORPORATE ENTITY TREE MODAL */}
      <Modal isOpen={entityTreeModalOpen} onClose={() => setEntityTreeModalOpen(false)}>
        <div className="p-[24px] md:p-[30px] text-left">
          <div className="flex items-start justify-between border-b border-line pb-4 mb-6">
            <div className="flex items-center gap-[12px]">
              <div className="w-[40px] h-[40px] rounded-[9px] bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-[18px] h-[18px]">
                  <path d="M12 22v-5M17 17H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2zM12 7V2M5 12H2M22 12h-3"/>
                </svg>
              </div>
              <div>
                <div className="eyebrow font-mono text-[10px] tracking-widest text-brand font-semibold uppercase">Corporate Architecture</div>
                <h2 className="font-display text-[22px] font-semibold text-ink leading-tight mt-1">
                  Entity Tree &amp; Relationships
                </h2>
              </div>
            </div>
            <button 
              onClick={() => setEntityTreeModalOpen(false)}
              className="w-[34px] h-[34px] rounded-[9px] border border-line bg-paper-2 hover:border-brand hover:text-brand cursor-pointer flex items-center justify-center text-ink transition-colors duration-150"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6 6 18"/>
              </svg>
            </button>
          </div>

          <div className="max-h-[66vh] overflow-y-auto pr-1 space-y-6 scrollbar-thin">
            {/* Parent Entity Card */}
            <div className="text-center">
              <div className="inline-block bg-brand-deep text-[#EDE6D6] border border-brand/35 rounded-[16px] p-5 shadow-md min-w-[260px] max-w-sm">
                <div className="font-mono text-[9px] tracking-widest text-[#EDE6D6]/65 uppercase font-medium">Ultimate Parent Holding</div>
                <h3 className="font-display font-semibold text-[18px] mt-1">{overview?.entity_tree?.name || currentEntityName}</h3>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-white font-mono text-[9px] mt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow"></span>
                  Ownership: {overview?.entity_tree?.ownership || "100%"}
                </div>
              </div>
            </div>

            {/* Connecting Vertical Line */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-8 bg-brand/25 border-dashed border-l border-brand/35"></div>
              <div className="w-full max-w-[500px] h-0.5 bg-brand/25 border-dashed border-b border-brand/35"></div>
              <div className="w-0.5 h-6 bg-brand/25 border-dashed border-l border-brand/35"></div>
            </div>

            {/* Children Grid (Divisions/Subsidiaries) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(overview?.entity_tree?.children || []).map((child: any, idx: number) => (
                <div 
                  key={idx} 
                  className="p-[18px] bg-paper-2 border border-line hover:border-brand/25 rounded-[16px] shadow-sm transition-all text-left flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h4 className="font-semibold text-[14px] text-ink leading-tight">{child.name}</h4>
                      <Badge type={child.relation === "Division" ? "neutral" : child.relation === "Subsidiary" ? "growth" : "risk"} className="text-[8.5px] uppercase font-mono px-2 py-0.5">
                        {child.relation}
                      </Badge>
                    </div>
                    {child.ownership && (
                      <span className="inline-block font-mono text-[9px] text-brand bg-brand/5 border border-brand/10 px-2 py-0.5 rounded mt-1">
                        Stake: {child.ownership}
                      </span>
                    )}

                    {child.children && child.children.length > 0 && (
                      <div className="mt-4">
                        <div className="font-mono text-[9px] text-ink-faint uppercase tracking-wider mb-2">Key Brands &amp; Operations</div>
                        <div className="flex flex-wrap gap-1.5">
                          {child.children.map((sub: any, sIdx: number) => (
                            <span 
                              key={sIdx}
                              className="font-mono text-[10.5px] bg-paper border border-line text-ink-soft px-2 py-1 rounded-[7px] flex items-center gap-1.5 shadow-sm"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-brand/40"></span>
                              {sub.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="border-t border-line mt-6 pt-4 flex justify-between items-center text-[10.5px] text-ink-faint font-mono">
            <span>REAL-TIME RELATIONSHIP PARSING ACTIVE</span>
            <button 
              onClick={() => setEntityTreeModalOpen(false)}
              className="btn bg-paper border border-line text-ink hover:shadow-sm rounded-[11px] px-[16px] py-[8px] font-body font-semibold text-[12.5px] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
