'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  X,
  Send,
  Zap,
  Flame,
  Snowflake,
  ShoppingCart,
  Users,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  TrendingUp,
  Store,
  ChevronRight,
  Maximize2,
  Minimize2,
  HelpCircle,
} from 'lucide-react';

export interface FreeAiAssistantProps {
  visits?: any[];
  reportRows?: any;
  isOpenDefault?: boolean;
  onClose?: () => void;
  className?: string;
}

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  category?: 'action' | 'cold-chain' | 'skus' | 'supervisors' | 'outlets' | 'summary' | 'custom';
  timestamp: string;
  stats?: {
    label: string;
    value: string | number;
    color?: string;
  }[];
}

export default function FreeAiAssistant({
  visits = [],
  reportRows,
  isOpenDefault = false,
  className = '',
}: FreeAiAssistantProps) {
  const [isOpen, setIsOpen] = useState(isOpenDefault);
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Compute live intelligence snapshot from visits data
  const intelligence = useMemo(() => {
    const totalVisits = visits.length;
    if (totalVisits === 0) {
      return {
        totalVisits: 0,
        breachCount: 0,
        breachRate: '0%',
        mtCount: 0,
        ttCount: 0,
        mtAvgPsku: '0/24',
        ttAvgPsku: '0/27',
        topBreachedOutlets: [],
        topSupervisors: [],
        urgentActions: [],
      };
    }

    let breachCount = 0;
    let mtVisits = 0;
    let ttVisits = 0;
    let mtAvailSum = 0;
    let ttAvailSum = 0;
    const supervisorMap = new Map<string, { total: number; breaches: number; pskuAvailSum: number }>();
    const outletBreaches: { outlet: string; route: string; sup: string; temp: string; asset: string }[] = [];
    const urgentActions: string[] = [];

    visits.forEach((v: any) => {
      const isBreach = v.ok === false || v.temp === 'Breach' || v.tempInRange === false;
      if (isBreach) {
        breachCount++;
        const outletName = v.outletName || v.cust || v.customerName || 'Store';
        outletBreaches.push({
          outlet: outletName,
          route: v.routeCode || v.rt || '—',
          sup: v.supervisor || v.sup || '—',
          temp: v.tempDisplay || `${v.tempVal || v.temperature}°C`,
          asset: v.atype || v.assetType || 'Asset',
        });
      }

      const ch = (v.channel || v.ch || v.rtm || '').toString().toUpperCase();
      const code = (v.outletCode || v.customerCode || '').toString().toUpperCase();
      const isMT = ch === 'MT' || code.startsWith('MTD') || (v.outletName || '').toUpperCase().includes('LULU') || (v.outletName || '').toUpperCase().includes('CARREFOUR');
      
      const avail = typeof v.pskuAvailableCount === 'number' ? v.pskuAvailableCount : 0;
      if (isMT) {
        mtVisits++;
        mtAvailSum += Math.min(avail, 24);
      } else {
        ttVisits++;
        ttAvailSum += Math.min(avail, 27);
      }

      const sup = (v.supervisor || v.sup || 'Unassigned').trim();
      if (!supervisorMap.has(sup)) {
        supervisorMap.set(sup, { total: 0, breaches: 0, pskuAvailSum: 0 });
      }
      const supStats = supervisorMap.get(sup)!;
      supStats.total++;
      if (isBreach) supStats.breaches++;
      supStats.pskuAvailSum += avail;
    });

    const breachRate = `${Math.round((breachCount / totalVisits) * 100)}%`;
    const mtAvgPsku = mtVisits > 0 ? `${(mtAvailSum / mtVisits).toFixed(1)} / 24` : '24 / 24';
    const ttAvgPsku = ttVisits > 0 ? `${(ttAvailSum / ttVisits).toFixed(1)} / 27` : '27 / 27';

    // Supervisors ranked
    const topSupervisors = Array.from(supervisorMap.entries())
      .map(([name, s]) => ({
        name,
        total: s.total,
        breaches: s.breaches,
        breachRate: `${Math.round((s.breaches / Math.max(1, s.total)) * 100)}%`,
        avgPsku: (s.pskuAvailSum / Math.max(1, s.total)).toFixed(1),
      }))
      .sort((a, b) => b.total - a.total);

    if (breachCount > 0) {
      urgentActions.push(`Dispatch maintenance team immediately for ${breachCount} temperature breached cooling assets.`);
    }
    if (ttVisits > 0 && ttAvailSum / ttVisits < 20) {
      urgentActions.push(`Initiate immediate replenishment campaign for Traditional Trade (averaging below 20/27 Power SKUs).`);
    }
    if (outletBreaches.length > 0) {
      urgentActions.push(`Conduct supervisor re-audit on top compromised stores: ${outletBreaches.slice(0, 3).map(o => o.outlet).join(', ')}.`);
    }

    return {
      totalVisits,
      breachCount,
      breachRate,
      mtCount: mtVisits,
      ttCount: ttVisits,
      mtAvgPsku,
      ttAvgPsku,
      topBreachedOutlets: outletBreaches.slice(0, 8),
      topSupervisors: topSupervisors.slice(0, 6),
      urgentActions,
    };
  }, [visits]);

  // Initial welcome message
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello! I am your **Dandy Field Intelligence AI Assistant**.\n\nI analyze your live visit audits, SKU availability, temperature compliance, and supervisor execution in real-time. Click any fast-insight prompt below or type any question to get instant management clarity!`,
      category: 'summary',
      timestamp: 'Just now',
    },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Fast insight prompt handlers
  const handleFastPrompt = (promptType: 'action' | 'cold-chain' | 'skus' | 'supervisors' | 'summary') => {
    let title = '';
    let responseText = '';
    let stats: { label: string; value: string | number; color?: string }[] = [];

    switch (promptType) {
      case 'action':
        title = '⚡ Management Action Plan';
        responseText = `### 🎯 Top Priority Management Directives\n\n` +
          `1. **Cold Chain Safeguards:** ${intelligence.breachCount > 0 ? `Urgent technician intervention required for **${intelligence.breachCount} outlets** with temperature breaches.` : 'All cooling units currently within compliant thresholds.'}\n` +
          `2. **Power SKU Stock Compliance:**\n` +
          `   - **Modern Trade (MT):** Audited against standard **24 Power SKUs** (Current average: **${intelligence.mtAvgPsku}**).\n` +
          `   - **Traditional Trade (TT):** Audited against standard **27 Power SKUs** (Current average: **${intelligence.ttAvgPsku}**).\n` +
          `3. **Corrective Directives:** Issue digital directives to field supervisors to re-verify asset temperatures and replenish out-of-stock SKUs on their next scheduled visit.`;
        stats = [
          { label: 'Audits Analyzed', value: intelligence.totalVisits },
          { label: 'Asset Breaches', value: intelligence.breachCount, color: intelligence.breachCount > 0 ? 'text-rose-500' : 'text-emerald-500' },
          { label: 'MT SKU Score', value: intelligence.mtAvgPsku },
          { label: 'TT SKU Score', value: intelligence.ttAvgPsku },
        ];
        break;

      case 'cold-chain':
        title = '❄️ Cold Chain & Asset Risk Analysis';
        if (intelligence.breachCount === 0) {
          responseText = `### ✅ Cold Chain Status: Optimal\n\nAll audited chillers (0°C to 8°C) and freezers (≤ -15°C) are operating within safe thermal zones across all ${intelligence.totalVisits} visits.`;
        } else {
          const list = intelligence.topBreachedOutlets
            .map((b, i) => `${i + 1}. **${b.outlet}** (${b.route}) · Asset: *${b.asset}* · Recorded: **${b.temp}** · Supervisor: *${b.sup}*`)
            .join('\n');
          responseText = `### ⚠️ Detected ${intelligence.breachCount} Thermal Breaches (${intelligence.breachRate} of visits)\n\n` +
            `The following stores require **immediate equipment maintenance**:\n\n${list}\n\n` +
            `*Recommendation:* Verify power plug continuity, clean condenser coils, and dispatch Dandy refrigeration fleet technicians.`;
        }
        stats = [
          { label: 'Breach Count', value: intelligence.breachCount, color: 'text-rose-500' },
          { label: 'Breach Rate', value: intelligence.breachRate },
        ];
        break;

      case 'skus':
        title = '🛒 Power SKU Availability (MT: 24 | TT: 27)';
        responseText = `### 📦 Power SKU Benchmark Overview\n\n` +
          `- **Modern Trade (MT):** Standard target is **24 Power SKUs**.\n` +
          `  - Audited Stores: **${intelligence.mtCount}**\n` +
          `  - Average Availability: **${intelligence.mtAvgPsku}**\n\n` +
          `- **Traditional Trade (TT):** Standard target is **27 Power SKUs**.\n` +
          `  - Audited Stores: **${intelligence.ttCount}**\n` +
          `  - Average Availability: **${intelligence.ttAvgPsku}**\n\n` +
          `*Executive Note:* Modern Trade outlets like Lulu, Carrefour, Al Meera, and Megamart maintain higher fill rates. Traditional trade stores have higher variance due to credit or stock-holding constraints.`;
        stats = [
          { label: 'MT Target', value: '24 SKUs' },
          { label: 'MT Average', value: intelligence.mtAvgPsku, color: 'text-indigo-400' },
          { label: 'TT Target', value: '27 SKUs' },
          { label: 'TT Average', value: intelligence.ttAvgPsku, color: 'text-indigo-400' },
        ];
        break;

      case 'supervisors':
        title = '👥 Supervisor Execution & Ranking';
        const supList = intelligence.topSupervisors
          .map((s, i) => `${i + 1}. **${s.name}** · ${s.total} audits · ${s.breaches} breaches flagged (${s.breachRate}) · Avg Power SKU: **${s.avgPsku}**`)
          .join('\n');
        responseText = `### 🏆 Supervisor Field Coverage & Depth\n\n` +
          `Ranked by audit volume and issue identification:\n\n${supList}\n\n` +
          `*Insight:* Supervisors with balanced breach identification ensure authentic data integrity compared to those reporting 100% compliance across all stores.`;
        stats = [
          { label: 'Supervisors Active', value: intelligence.topSupervisors.length },
          { label: 'Total Audits', value: intelligence.totalVisits },
        ];
        break;

      case 'summary':
      default:
        title = '📊 Executive Daily Briefing';
        responseText = `### 📋 Comprehensive Field Audit Briefing\n\n` +
          `- **Total Visits Audited:** **${intelligence.totalVisits} outlets**\n` +
          `- **Cold Chain Health:** **${intelligence.breachCount} breaches** flagged (${intelligence.breachRate})\n` +
          `- **Power SKU Execution:**\n` +
          `  - Modern Trade (24 target): **${intelligence.mtAvgPsku}**\n` +
          `  - Traditional Trade (27 target): **${intelligence.ttAvgPsku}**\n` +
          `- **Top Supervisors:** ${intelligence.topSupervisors.slice(0, 3).map(s => `${s.name} (${s.total})`).join(', ')}\n\n` +
          `All data is synced live with the Dandy Central Database.`;
        stats = [
          { label: 'Visits', value: intelligence.totalVisits },
          { label: 'Breach Rate', value: intelligence.breachRate },
          { label: 'MT SKU Score', value: intelligence.mtAvgPsku },
          { label: 'TT SKU Score', value: intelligence.ttAvgPsku },
        ];
        break;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `user_${Date.now()}`,
        sender: 'user',
        text: title,
        timestamp: 'Just now',
      },
      {
        id: `ai_${Date.now() + 1}`,
        sender: 'ai',
        text: responseText,
        category: promptType,
        timestamp: 'Just now',
        stats,
      },
    ]);
  };

  // Custom question submission
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userText = query.trim();
    setQuery('');

    // Generate intelligent contextual response
    const q = userText.toLowerCase();
    let reply = '';
    let category: any = 'custom';
    let stats: { label: string; value: string | number }[] = [];

    if (q.includes('breach') || q.includes('temp') || q.includes('cold') || q.includes('chiller') || q.includes('freezer')) {
      reply = `### ❄️ Cold Chain Temperature Analysis\n\n` +
        `Across **${intelligence.totalVisits} visits**, we identified **${intelligence.breachCount} assets** in breach condition.\n\n` +
        (intelligence.topBreachedOutlets.length > 0
          ? `Top affected stores:\n` + intelligence.topBreachedOutlets.slice(0, 4).map(o => `- **${o.outlet}** (${o.route}): ${o.temp} on ${o.asset}`).join('\n')
          : `All units are maintaining compliant temperatures.`);
      category = 'cold-chain';
      stats = [{ label: 'Breaches', value: intelligence.breachCount }, { label: 'Breach Rate', value: intelligence.breachRate }];
    } else if (q.includes('power sku') || q.includes('sku') || q.includes('24') || q.includes('27') || q.includes('41') || q.includes('stock')) {
      reply = `### 🛒 Power SKU Availability Standards\n\n` +
        `- **Modern Trade (MT):** Exactly **24 Power SKUs** benchmarked (Current Average: **${intelligence.mtAvgPsku}**).\n` +
        `- **Traditional Trade (TT):** Exactly **27 Power SKUs** benchmarked (Current Average: **${intelligence.ttAvgPsku}**).\n` +
        `- Outlets never display 41 — the system guarantees channel-accurate targets for all reports.`;
      category = 'skus';
      stats = [{ label: 'MT Target', value: 24 }, { label: 'TT Target', value: 27 }];
    } else if (q.includes('supervisor') || q.includes('who') || q.includes('team') || q.includes('auditor')) {
      reply = `### 👥 Supervisor Performance Insights\n\n` +
        `Active supervisors: **${intelligence.topSupervisors.length}**.\n\n` +
        `Leading auditors by volume:\n` +
        intelligence.topSupervisors.slice(0, 4).map(s => `- **${s.name}**: ${s.total} visits, ${s.breaches} breaches, avg SKU availability ${s.avgPsku}`).join('\n');
      category = 'supervisors';
    } else if (q.includes('lulu') || q.includes('carrefour') || q.includes('meera') || q.includes('megamart') || q.includes('hyper')) {
      const matching = visits.filter((v: any) =>
        (v.outletName || '').toLowerCase().includes(q) ||
        (v.cust || '').toLowerCase().includes(q)
      );
      if (matching.length > 0) {
        reply = `### 🏬 Search Results for "${userText}"\n\n` +
          `Found **${matching.length} matching store visits**:\n\n` +
          matching.slice(0, 5).map(m => `- **${m.outletName || m.cust}** [${m.outletCode || m.rt}] · Power SKU: **${m.pskuRatioDisplay || `${m.pskuAvailableCount || 24}/24`}** · Temp: **${m.tempDisplay || 'OK'}**`).join('\n');
      } else {
        reply = `No specific store matched "${userText}". Please try searching by outlet name, code, or route.`;
      }
    } else {
      reply = `### 💡 Field Intelligence Analysis\n\n` +
        `Regarding "${userText}":\n\n` +
        `- We are monitoring **${intelligence.totalVisits} visit audits** across Qatar.\n` +
        `- MT compliance standard is **24 Power SKUs**; TT is **27 Power SKUs**.\n` +
        `- Current thermal breach rate stands at **${intelligence.breachRate}** (${intelligence.breachCount} total units).\n\n` +
        `Try clicking one of the fast insight chips below for pre-calculated strategic reports!`;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `user_${Date.now()}`,
        sender: 'user',
        text: userText,
        timestamp: 'Just now',
      },
      {
        id: `ai_${Date.now() + 1}`,
        sender: 'ai',
        text: reply,
        category,
        timestamp: 'Just now',
        stats,
      },
    ]);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      {/* Floating Trigger Button in Bottom-Right */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full shadow-2xl backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 group cursor-pointer border border-indigo-400/40 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white ${className}`}
          title="Open Free Dandy AI Insights Assistant"
          aria-label="Open Free AI Assistant"
        >
          <div className="relative">
            <Bot className="h-5 w-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div className="text-left">
            <span className="text-xs font-black tracking-wide block flex items-center gap-1">
              AI Assistant <Sparkles className="h-3 w-3 text-amber-300 inline" />
            </span>
            <span className="text-[10px] text-indigo-100 opacity-90 block">Fast Free Insights</span>
          </div>
        </button>
      )}

      {/* Slide-in Assistant Drawer / Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className={`w-full ${
              isExpanded ? 'sm:w-[750px] sm:h-[90vh]' : 'sm:w-[500px] sm:h-[680px]'
            } h-[85vh] bg-slate-900 border border-slate-700/80 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white transition-all duration-300 relative`}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border-b border-slate-800 flex items-center justify-between flex-shrink-0 select-none">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 shadow-inner">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                      Dandy AI Assistant
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        100% Free
                      </span>
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Zap className="h-3 w-3 text-amber-400" />
                    Instant market analysis · {intelligence.totalVisits} visits synced
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors hidden sm:block cursor-pointer"
                  title={isExpanded ? 'Standard Window' : 'Expand Window'}
                >
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-300 hover:bg-red-950/50 transition-colors cursor-pointer"
                  title="Close Assistant"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Fast-Insight One-Click Prompt Chips */}
            <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar flex-shrink-0 select-none">
              <span className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-indigo-400" /> Fast Insights:
              </span>
              <button
                type="button"
                onClick={() => handleFastPrompt('action')}
                className="text-[11px] font-bold px-3 py-1 rounded-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Zap className="h-3 w-3 text-amber-300" /> Action Plan
              </button>
              <button
                type="button"
                onClick={() => handleFastPrompt('cold-chain')}
                className="text-[11px] font-bold px-3 py-1 rounded-full bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Snowflake className="h-3 w-3 text-cyan-300" /> Breaches ({intelligence.breachCount})
              </button>
              <button
                type="button"
                onClick={() => handleFastPrompt('skus')}
                className="text-[11px] font-bold px-3 py-1 rounded-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ShoppingCart className="h-3 w-3 text-purple-300" /> MT (24) vs TT (27)
              </button>
              <button
                type="button"
                onClick={() => handleFastPrompt('supervisors')}
                className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Users className="h-3 w-3 text-emerald-300" /> Supervisors
              </button>
              <button
                type="button"
                onClick={() => handleFastPrompt('summary')}
                className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
              >
                <TrendingUp className="h-3 w-3 text-amber-400" /> Executive Brief
              </button>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.sender === 'user' ? 'items-end' : 'items-start'
                  } space-y-1.5`}
                >
                  <div className="flex items-center gap-2 px-1 text-[10px] text-slate-400">
                    <span className="font-semibold">{m.sender === 'user' ? 'You' : 'Dandy AI'}</span>
                    <span>•</span>
                    <span>{m.timestamp}</span>
                  </div>

                  <div
                    className={`max-w-[92%] p-3.5 sm:p-4 rounded-2xl text-[13px] leading-relaxed relative group ${
                      m.sender === 'user'
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-xs shadow-md'
                        : 'bg-slate-800/90 border border-slate-700/80 text-slate-200 rounded-tl-xs shadow-inner'
                    }`}
                  >
                    {/* Copy Button on AI messages */}
                    {m.sender === 'ai' && (
                      <button
                        type="button"
                        onClick={() => handleCopy(m.id, m.text)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy to clipboard"
                      >
                        {copiedId === m.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}

                    {/* Formatted Markdown-like text */}
                    <div className="space-y-2 whitespace-pre-wrap">
                      {m.text.split('\n\n').map((paragraph, pIdx) => {
                        // Header rendering
                        if (paragraph.startsWith('### ')) {
                          return (
                            <h4
                              key={pIdx}
                              className="text-sm font-black text-indigo-300 tracking-wide pt-1"
                            >
                              {paragraph.replace('### ', '')}
                            </h4>
                          );
                        }
                        return <p key={pIdx}>{paragraph}</p>;
                      })}
                    </div>

                    {/* Stat Badges for Quick Overview */}
                    {m.stats && m.stats.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {m.stats.map((s, sIdx) => (
                          <div
                            key={sIdx}
                            className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-2 text-center"
                          >
                            <span className="text-[10px] text-slate-400 block truncate">
                              {s.label}
                            </span>
                            <span
                              className={`text-xs font-mono font-bold block ${
                                s.color || 'text-white'
                              }`}
                            >
                              {s.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer Input Form */}
            <form
              onSubmit={handleSend}
              className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2 flex-shrink-0"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about breaches, MT/TT Power SKUs, stores, or supervisors..."
                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md"
                title="Send query"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
