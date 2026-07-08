// Pure HTML-string builders for every dynamic section of the dashboard, plus
// a small set of DOM-interaction helpers (nav, theme, chart toggle,
// accordions, bar entrance animation).
//
// These build*() functions take data and return HTML strings — no DOM
// access, no side effects. app/page.tsx calls them at module scope (so the
// server-rendered HTML already contains real numbers/charts/tables on first
// paint — no flash from placeholder "—" to real values). Business Metrics is
// the one section that also needs a *runtime* re-render (the quarter
// filter), so mountBusinessMetrics() wraps the pure builder with a DOM write
// for that one case.
import type { Deal, DashboardData, Project, Partner, PositiveInquiry } from "./parseExcel";
import type { BmQuarterDisplay, BmMetric } from "./parseExcel";

const fmt = (n: number) =>
  n >= 1e6 ? "LKR " + (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? "LKR " + Math.round(n / 1e3) + "K" : "LKR " + n;

const parseDateVal = (d: string) => (d ? new Date(d).getTime() || 0 : 0);

const fmtClose = (d: string) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const escHtml = (s: any) =>
  String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const DONUT_COLORS: Record<string, string> = {
  Inquiry: "#FFC9EA", Exploration: "#F77FCC", "POC/Demo": "#E82AAE",
  Proposal: "#C71B91", Negotiations: "#9E1474", Contracted: "#26EA9F",
  Lost: "#7A7A88", Morphed: "#3F3F4A",
};
const STAGE_ORDER = ["Inquiry", "Exploration", "POC/Demo", "Proposal", "Negotiations", "Contracted", "Lost", "Morphed"];
const ACTIVE_STAGES = ["Contracted", "Negotiations", "Proposal", "POC/Demo", "Exploration", "Inquiry"];

// A bar rendered with data-w (and width already 0) grows into place once
// animateBars() runs post-mount, instead of appearing at full size.
const animatedBar = (widthPct: number | string) => `width:0%" data-w="${widthPct}%`;

// ============ OVERVIEW (funnel / donut / stage breakdown / KPIs / source chart) ============
export interface OverviewBuild {
  kpis: { active: number; total: number; won: number; closedLost: number; winRate: string };
  funnelHtml: string;
  stageValueHtml: string;
  donutTotal: number;
  donutPathsHtml: string;
  donutLegendHtml: string;
  stageBreakdownHtml: string;
  sourceChartHtml: string;
  sourceLegendHtml: string;
}

export function buildOverview(deals: Deal[]): OverviewBuild {
  const stageCounts: Record<string, number> = { Inquiry: 0, Exploration: 0, "POC/Demo": 0, Proposal: 0, Negotiations: 0, Contracted: 0, Lost: 0, Morphed: 0 };
  const stageValues: Record<string, number> = { Inquiry: 0, Exploration: 0, "POC/Demo": 0, Proposal: 0, Negotiations: 0, Contracted: 0, Lost: 0, Morphed: 0 };
  deals.forEach((d) => {
    if (Object.prototype.hasOwnProperty.call(stageCounts, d.stage)) {
      stageCounts[d.stage]++;
      stageValues[d.stage] += d.value || 0;
    }
  });

  const newStages = ACTIVE_STAGES.map((n) => ({ name: n, count: stageCounts[n], value: stageValues[n] }));
  const newClosed = { name: "Lost / Morphed", count: stageCounts.Lost + stageCounts.Morphed, value: stageValues.Lost + stageValues.Morphed };
  const totalCount = Object.values(stageCounts).reduce((a, b) => a + b, 0);

  const won = stageCounts.Contracted;
  const closedLost = stageCounts.Lost + stageCounts.Morphed;
  const active = deals.length - closedLost;
  const winRate = won + closedLost > 0 ? ((won / (won + closedLost)) * 100).toFixed(1) + "%" : "0%";

  // Funnel
  const fMax = Math.max(...newStages.map((s) => s.count), newClosed.count, 1);
  let funnelHtml = newStages
    .map((s) => {
      const w = (s.count / fMax) * 100;
      const pct = ((s.count / totalCount) * 100 || 0).toFixed(1);
      return `<div class="funnel-row"><div class="funnel-label">${s.name}</div><div class="funnel-bar-wrap"><div class="funnel-bar" style="${animatedBar(w)}">${s.count}</div></div><div class="funnel-pct">${pct}%</div></div>`;
    })
    .join("");
  {
    const cw = (newClosed.count / fMax) * 100;
    const cpct = ((newClosed.count / totalCount) * 100 || 0).toFixed(1);
    funnelHtml += `<div class="funnel-row" style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--border);"><div class="funnel-label">${newClosed.name}</div><div class="funnel-bar-wrap"><div class="funnel-bar" style="${animatedBar(cw)};background:linear-gradient(90deg,#7A7A88 0%,#5C5C68 100%);box-shadow:none;">${newClosed.count}</div></div><div class="funnel-pct">${cpct}%</div></div>`;
  }

  // Stage value bars
  const vMax = Math.max(...newStages.map((s) => s.value), 1);
  let stageValueHtml = newStages
    .map((s) => {
      const w = s.value === 0 ? 2 : (s.value / vMax) * 100;
      return `<div class="stage-value-row"><div class="funnel-label">${s.name}</div><div class="sv-bar-wrap"><div class="sv-bar ${s.value === 0 ? "dim" : ""}" style="${animatedBar(w)}"></div></div><div class="sv-num">${fmt(s.value)}</div></div>`;
    })
    .join("");
  stageValueHtml += `<div class="stage-value-row" style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--border);"><div class="funnel-label">${newClosed.name}</div><div class="sv-bar-wrap"><div class="sv-bar" style="${animatedBar(100)};background:#7A7A88;"></div></div><div class="sv-num">${fmt(newClosed.value)}</div></div>`;

  // Donut
  const donutStages = [...newStages, { name: "Lost", count: stageCounts.Lost }, { name: "Morphed", count: stageCounts.Morphed }];
  let cumA = -Math.PI / 2;
  const R = 92, ri = 58;
  let donutPathsHtml = "";
  let donutLegendHtml = "";
  donutStages.forEach((s) => {
    const a = totalCount > 0 ? (s.count / totalCount) * Math.PI * 2 : 0;
    const x1 = Math.cos(cumA) * R, y1 = Math.sin(cumA) * R;
    const x2 = Math.cos(cumA + a) * R, y2 = Math.sin(cumA + a) * R;
    const xi1 = Math.cos(cumA) * ri, yi1 = Math.sin(cumA) * ri;
    const xi2 = Math.cos(cumA + a) * ri, yi2 = Math.sin(cumA + a) * ri;
    const large = a > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ri} ${ri} 0 ${large} 0 ${xi1} ${yi1} Z`;
    donutPathsHtml += `<path d="${d}" fill="${DONUT_COLORS[s.name] || "#888"}" style="stroke:var(--panel)" stroke-width="2"/>`;
    cumA += a;
    donutLegendHtml += `<div class="legend-row"><span class="legend-dot" style="background:${DONUT_COLORS[s.name] || "#888"}"></span><span class="legend-name">${s.name}</span><span class="legend-val">${s.count}</span></div>`;
  });

  // Stage breakdown accordion
  const stageGroupOrder = ["Contracted", "Negotiations", "Proposal", "POC/Demo", "Exploration", "Inquiry"];
  const groups = [
    ...stageGroupOrder.map((n) => ({ label: n, match: (d: Deal) => d.stage === n })),
    { label: "Morphed", match: (d: Deal) => d.stage === "Morphed" },
    { label: "Lost", match: (d: Deal) => d.stage === "Lost" },
  ];
  const stageBreakdownHtml = groups
    .map((group, i) => {
      const ds = deals.filter(group.match).sort((a, b) => parseDateVal(b.close) - parseDateVal(a.close));
      const cnt = ds.length;
      const tot = ds.reduce((s, d) => s + (d.value || 0), 0);
      const isClosedOut = group.label === "Morphed";
      const rowStyle = isClosedOut ? ' style="border-top:2px solid var(--border-strong);"' : "";
      return `
        <tr class="summary-row"${rowStyle} data-idx="${i}">
          <td><span class="chevron">›</span></td>
          <td class="col-stage">${group.label}</td>
          <td class="col-count">${cnt}</td>
          <td class="col-value">${tot.toLocaleString()}</td>
        </tr>
        <tr class="detail-row" data-idx="${i}" style="display:none;">
          <td colspan="4"><div class="detail-content">
            <table class="deal-list-table">
              <colgroup><col class="dl-col-name"/><col class="dl-col-account"/><col class="dl-col-value"/><col class="dl-col-date"/></colgroup>
              <thead><tr><th>Deal</th><th>Account</th><th class="dl-th-value">Value (LKR)</th><th class="dl-th-date">Last Updated</th></tr></thead>
              <tbody>${
                ds.length
                  ? ds.map((d) => `<tr><td class="dl-name" title="${escHtml(d.name)}">${d.name}</td><td>${d.co}</td><td class="dl-value">${d.value ? d.value.toLocaleString() : "TBC"}</td><td class="dl-date">${fmtClose(d.close)}</td></tr>`).join("")
                  : '<tr><td colspan="4" class="dl-empty">No deals in this stage.</td></tr>'
              }</tbody>
            </table>
          </div></td>
        </tr>
      `;
    })
    .join("");

  const { sourceChartHtml, sourceLegendHtml } = buildSourceChart(deals);

  return {
    kpis: { active, total: deals.length, won, closedLost, winRate },
    funnelHtml,
    stageValueHtml,
    donutTotal: totalCount,
    donutPathsHtml,
    donutLegendHtml,
    stageBreakdownHtml,
    sourceChartHtml,
    sourceLegendHtml,
  };
}

// ============ DEAL STAGES BY SOURCE (stacked bar, derived from deals) ============
function buildSourceChart(deals: Deal[]): { sourceChartHtml: string; sourceLegendHtml: string } {
  const normSource = (s: string) => {
    const v = String(s || "").trim();
    if (/^ref+erral$/i.test(v)) return "Referral";
    return v || "Unknown";
  };
  const bySource = new Map<string, { source: string; total: number; stages: Record<string, number> }>();
  deals.forEach((d) => {
    const src = normSource(d.source);
    if (!bySource.has(src)) bySource.set(src, { source: src, total: 0, stages: {} });
    const row = bySource.get(src)!;
    row.total++;
    row.stages[d.stage] = (row.stages[d.stage] || 0) + 1;
  });
  const sourceData = [...bySource.values()].sort((a, b) => b.total - a.total);

  const sourceMax = Math.max(...sourceData.map((s) => s.total), 1);
  const lightStages = new Set(["Inquiry", "Exploration"]);

  const sourceChartHtml = sourceData
    .map((row) => {
      const barW = (row.total / sourceMax) * 100;
      let segments = "";
      STAGE_ORDER.forEach((stage) => {
        const count = row.stages[stage] || 0;
        if (count === 0) return;
        const segPct = (count / row.total) * 100;
        const segTextColor = lightStages.has(stage) ? "#1A1A22" : "#FFFFFF";
        segments += `<div class="source-seg" style="width:${segPct}%;background:${DONUT_COLORS[stage]};color:${segTextColor}" title="${stage}: ${count}">${count}</div>`;
      });
      return `<div class="source-row"><div class="source-label" title="${row.source}">${row.source}</div><div class="source-bar-wrap" style="${animatedBar(barW)}">${segments}</div><div class="source-total">${row.total}</div></div>`;
    })
    .join("");

  const usedStages = new Set<string>();
  sourceData.forEach((row) => Object.keys(row.stages).forEach((st) => usedStages.add(st)));
  const sourceLegendHtml = STAGE_ORDER.filter((s) => usedStages.has(s))
    .map((stage) => `<div class="legend-row"><span class="legend-dot" style="background:${DONUT_COLORS[stage]}"></span><span class="legend-name">${stage}</span></div>`)
    .join("");

  return { sourceChartHtml, sourceLegendHtml };
}

// ============ BUSINESS METRICS ============
const HIGH_RATE_THRESHOLD = 0.5;

const fmtPct = (raw: number | null | undefined) => {
  if (raw === null || raw === undefined) return "—";
  const sign = raw > 0 ? "+" : "";
  return `${sign}${Math.round(raw * 100)}%`;
};
const isAbove = (raw: number | null | undefined) => raw !== null && raw !== undefined && raw > 0;

const renderBmCard = (m: BmMetric, vsLabel: string, pillLabel = "QTD", hideTargetHeading = false) => `
  <div class="bm-card ${isAbove(m.pctRaw) ? "above" : "below"}">
    <div class="bm-card-pill">
      <div class="bm-card-name">${m.name}</div>
      ${hideTargetHeading ? "" : '<div class="bm-card-target-heading">Target</div>'}
      <div class="bm-card-baseline-row">
        <span class="bm-card-baseline-group">
          <span class="bm-card-baseline-label">${pillLabel}</span>
          <span class="bm-card-baseline">${m.baseline}</span>
        </span>
        ${
          m.mtd !== undefined
            ? `
        <span class="bm-card-baseline-divider"></span>
        <span class="bm-card-baseline-group">
          <span class="bm-card-baseline-label">MTD</span>
          <span class="bm-card-baseline">${m.mtd}</span>
        </span>`
            : ""
        }
      </div>
    </div>
    <div class="bm-card-main">${m.current}</div>
    <div class="bm-card-foot">
      ${m.pctRaw === null || m.pctRaw === undefined ? "<span></span>" : `<span class="bm-card-pct">${fmtPct(m.pctRaw)}</span>`}
      <span class="bm-card-vs">${vsLabel}</span>
    </div>
  </div>
`;

export interface BmBuild {
  lastUpdated: string;
  businessCardsHtml: string;
  leadCardsHtml: string;
  ytdCardsHtml: string;
  stageCardsHtml: string;
  stageBadge: string;
  channelTableHtml: string;
  budgetCardsHtml: string;
  costCardsHtml: string;
}

export function buildBusinessMetrics(bmDataByQuarter: Record<string, BmQuarterDisplay>, activeQuarter: string): BmBuild | null {
  const data = bmDataByQuarter[activeQuarter];
  if (!data) return null;

  const businessCardsHtml = data.business.map((m) => renderBmCard(m, "vs last week", "QTD")).join("");
  const leadCardsHtml = data.leadGen.map((m) => renderBmCard(m, data.vsLabel, "Target QTD", true)).join("");
  const ytdCardsHtml = data.ytd.map((m) => renderBmCard(m, data.vsLabel)).join("");

  const stageCardsHtml = (data.stages || [])
    .map((s) => {
      const pct = data.totalDeals > 0 ? Math.round((s.count / data.totalDeals) * 100) : 0;
      const wonClass = s.name === "Contracted" ? " won" : "";
      return `
        <div class="bm-stage-card${wonClass}" style="--stage-color: ${s.color};">
          <div class="bm-stage-card-name">${s.name}</div>
          <div class="bm-stage-card-count">${s.count}</div>
          <div class="bm-stage-card-pct">${pct}% of total</div>
        </div>
      `;
    })
    .join("");
  const stageBadge = `snapshot · ${data.totalDeals} deals total`;

  let tAccounts = 0, tContacted = 0, tReplies = 0, tPositive = 0;
  let channelTableHtml = data.channels
    .map((c) => {
      const rate = c.contacted > 0 ? c.replies / c.contacted : 0;
      const ratePct = Math.round(rate * 100);
      const highClass = rate >= HIGH_RATE_THRESHOLD ? " high" : "";
      tAccounts += c.accounts;
      tContacted += c.contacted;
      tReplies += c.replies;
      tPositive += c.positive;
      return `
        <tr>
          <td class="channel-name">${c.name}</td>
          <td class="channel-num">${c.accounts}</td>
          <td class="channel-num">${c.contacted}</td>
          <td class="channel-num">${c.replies}</td>
          <td class="channel-num">${c.positive}</td>
          <td>
            <div class="rate-cell">
              <div class="rate-bar"><div class="rate-bar-fill${highClass}" style="${animatedBar(Math.min(ratePct, 100))}"></div></div>
              <div class="rate-pct${highClass}">${ratePct}%</div>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
  {
    const totalRate = tContacted > 0 ? tReplies / tContacted : 0;
    const totalPct = Math.round(totalRate * 100);
    channelTableHtml += `
      <tr class="total-row">
        <td class="channel-name">Total</td>
        <td class="channel-num">${tAccounts}</td>
        <td class="channel-num">${tContacted}</td>
        <td class="channel-num">${tReplies}</td>
        <td class="channel-num">${tPositive}</td>
        <td>
          <div class="rate-cell">
            <div class="rate-bar"><div class="rate-bar-fill" style="${animatedBar(Math.min(totalPct, 100))}"></div></div>
            <div class="rate-pct">${totalPct}%</div>
          </div>
        </td>
      </tr>
    `;
  }

  // Budget Utilization + Cost Efficiency
  const alloc = data.budget?.allocation ?? null;
  const spend = data.budget?.spend ?? null;
  const closedDeals = parseInt(String(data.business.find((m) => /closed deals/i.test(m.name))?.current ?? "")) || 0;
  const revenueLkrMn = parseFloat(String(data.business.find((m) => /^revenue/i.test(m.name))?.current ?? "")) || 0;
  const totalPositive = (data.channels || []).reduce((s, c) => s + (c.positive || 0), 0);

  const utilizationPct = alloc && alloc > 0 && spend !== null ? (spend / alloc) * 100 : null;
  const spendLkr = spend !== null ? spend * 1e6 : null;
  const costPerLead = spendLkr !== null && totalPositive > 0 ? spendLkr / totalPositive : null;
  const costPerAcq = spendLkr !== null && closedDeals > 0 ? spendLkr / closedDeals : null;
  const costPerRev = spend !== null && revenueLkrMn > 0 ? spend / revenueLkrMn : null;

  const stated = data.stated || ({} as BmQuarterDisplay["stated"]);
  const isNA = (v: any) => typeof v === "string" && v.trim().toUpperCase() === "N/A";
  const statedNum = (v: any) => (v === null || v === undefined || v === "" || isNA(v) || isNaN(+v) ? null : +v);
  const finalUtilPct = statedNum(stated.utilization) !== null ? statedNum(stated.utilization)! * 100 : utilizationPct;

  const fmtMn = (v: number | null) => (v === null ? '<span class="tbc">TBC</span>' : `${v}<span class="bm-simple-card-unit">LKR Mn</span>`);
  const fmtPctVal = (v: number | null) => (v === null ? '<span class="tbc">TBC</span>' : `${v.toFixed(1)}<span class="bm-simple-card-unit">%</span>`);
  const fmtLkrSmall = (v: number | null) => (v === null ? '<span class="tbc">TBC</span>' : `${Math.round(v).toLocaleString()}<span class="bm-simple-card-unit">LKR</span>`);
  const fmtRatio = (v: number | null) => (v === null ? '<span class="tbc">TBC</span>' : v.toFixed(2));

  let utilClass = "";
  if (finalUtilPct !== null) utilClass = finalUtilPct <= 100 ? " good" : " warn";

  const costInqDisplay = isNA(stated.costPerInquiry)
    ? "N/A"
    : statedNum(stated.costPerInquiry) !== null
    ? fmtLkrSmall(statedNum(stated.costPerInquiry))
    : fmtLkrSmall(costPerLead);
  const costAcqDisplay = isNA(stated.costPerAcq)
    ? "N/A"
    : statedNum(stated.costPerAcq) !== null
    ? fmtLkrSmall(statedNum(stated.costPerAcq))
    : costPerAcq !== null
    ? fmtLkrSmall(costPerAcq)
    : "N/A";
  const costRevDisplay = isNA(stated.costPerRev)
    ? "N/A"
    : statedNum(stated.costPerRev) !== null
    ? fmtRatio(statedNum(stated.costPerRev))
    : fmtRatio(costPerRev);

  const renderSimple = (label: string, value: string, context: string, statusClass = "", target: string | null = null) => `
    <div class="bm-simple-card${statusClass}">
      <div class="bm-simple-card-label">${label}</div>
      <div class="bm-simple-card-value">${value}</div>
      <div class="bm-simple-card-context">${context}</div>
      ${target !== null ? `<div class="bm-simple-card-target">Target: ${target}</div>` : ""}
    </div>
  `;

  const budgetCardsHtml =
    renderSimple("Allocation", fmtMn(alloc), "Total budget for the quarter") +
    renderSimple("Spend", fmtMn(spend), "Actual spend to date") +
    renderSimple("Utilization", fmtPctVal(finalUtilPct), "Spend ÷ Allocation", utilClass);

  const costCardsHtml =
    renderSimple("Cost per Inquiry", costInqDisplay, "") +
    renderSimple("Cost per Acquisition", costAcqDisplay, "") +
    renderSimple("Cost per Revenue", costRevDisplay, "");

  return {
    lastUpdated: data.lastUpdated,
    businessCardsHtml,
    leadCardsHtml,
    ytdCardsHtml,
    stageCardsHtml,
    stageBadge,
    channelTableHtml,
    budgetCardsHtml,
    costCardsHtml,
  };
}

const setHtml = (id: string, html: string) => {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
};
const setText = (id: string, text: string) => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};

// Runtime re-render for the one section that changes after mount (the
// quarter filter). Everything else is baked into the initial HTML.
export function mountBusinessMetrics(bmDataByQuarter: Record<string, BmQuarterDisplay>, activeQuarter: string) {
  const b = buildBusinessMetrics(bmDataByQuarter, activeQuarter);
  if (!b) return;
  setText("bmLastUpdated", b.lastUpdated);
  setHtml("bmBusinessCards", b.businessCardsHtml);
  setHtml("bmLeadCards", b.leadCardsHtml);
  setHtml("bmYtdCards", b.ytdCardsHtml);
  setHtml("bmStageCards", b.stageCardsHtml);
  setText("bmStageBadge", b.stageBadge);
  setHtml("channelTableBody", b.channelTableHtml);
  setHtml("bmBudgetCards", b.budgetCardsHtml);
  setHtml("bmCostCards", b.costCardsHtml);
  animateBars();
}

export function populateQuarterFilter(bmDataByQuarter: Record<string, BmQuarterDisplay>, activeQuarter: string) {
  const qf = document.getElementById("quarterFilter") as HTMLSelectElement | null;
  if (!qf) return;
  qf.innerHTML = Object.keys(bmDataByQuarter)
    .map((qcode) => `<option value="${qcode}">${escHtml(bmDataByQuarter[qcode]?.displayLabel || qcode)}</option>`)
    .join("");
  qf.value = activeQuarter;
}

// ============ PROJECTS ============
const cell = (val: any) => (!val || val === "TBC" ? '<span class="tbc">TBC</span>' : val);

function buildProjectRows(projectList: Project[], idxOffset: number): string {
  return projectList
    .map((p, i) => {
      const idx = idxOffset + i;
      const nextPreview = p.next || "—";
      return `
      <tr class="summary-row" data-idx="${idx}">
        <td><span class="chevron">›</span></td>
        <td class="col-client">${p.client}</td>
        <td class="col-project">${p.project}</td>
        <td><span class="type-pill type-${p.type}">${p.type}</span></td>
        <td><div class="next-preview" title="${escHtml(p.next || "")}">${nextPreview}</div></td>
      </tr>
      <tr class="detail-row" data-idx="${idx}" style="display:none;">
        <td colspan="5">
          <div class="detail-content">
            <div class="detail-field">
              <span class="detail-label">Overall Value</span>
              <span class="detail-value">${cell(p.value)}</span>
            </div>
            <div class="detail-field">
              <span class="detail-label">Billing Milestone</span>
              <span class="detail-value">${cell(p.milestone)}</span>
            </div>
            <div class="detail-field">
              <span class="detail-label">Milestone Date</span>
              <span class="detail-value">${cell(p.date)}</span>
            </div>
            <div class="detail-field">
              <span class="detail-label">Invoice Value</span>
              <span class="detail-value">${cell(p.invoice)}</span>
            </div>
            <div class="detail-field">
              <span class="detail-label">Man Days</span>
              <div class="mandays-split">
                <span class="mandays-sub-label">Planned</span>
                <span class="mandays-sub-value">${p.planned && p.planned !== "TBC" ? p.planned : "—"}</span>
                <span class="mandays-divider">|</span>
                <span class="mandays-sub-label">Actual</span>
                <span class="mandays-sub-value">${p.actual && p.actual !== "TBC" ? p.actual : "—"}</span>
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

export interface ProjectsBuild {
  ongoingHtml: string; toStartHtml: string; tbcHtml: string;
  emptyOngoing: boolean; emptyToStart: boolean; emptyTbc: boolean;
  countOngoing: number; countToStart: number; countTbc: number;
  totalBadge: string;
  kpiActiveProjects: number; kpiOngoing: number; kpiToStart: number;
  kpiConfirmedValue: string; kpiConfirmedNote: string;
}

export function buildProjects(allProjects: Project[]): ProjectsBuild {
  const ongoing = allProjects.filter((p) => p.status === "Ongoing");
  const toStart = allProjects.filter((p) => p.status === "To Start");
  const pending = allProjects.filter((p) => p.status === "TBC" || !p.status);

  const parseLkr = (v: any): number => {
    if (v === null || v === undefined) return NaN;
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? NaN : n;
  };
  const confirmedVals = allProjects.filter((p) => !isNaN(parseLkr(p.value)));
  const confirmedMn = confirmedVals.reduce((s, p) => s + parseLkr(p.value), 0) / 1e6;

  return {
    ongoingHtml: buildProjectRows(ongoing, 0),
    toStartHtml: buildProjectRows(toStart, ongoing.length),
    tbcHtml: buildProjectRows(pending, ongoing.length + toStart.length),
    emptyOngoing: ongoing.length === 0,
    emptyToStart: toStart.length === 0,
    emptyTbc: pending.length === 0,
    countOngoing: ongoing.length,
    countToStart: toStart.length,
    countTbc: pending.length,
    totalBadge: allProjects.length + " records · click row for detail",
    kpiActiveProjects: allProjects.length,
    kpiOngoing: ongoing.length,
    kpiToStart: toStart.length,
    kpiConfirmedValue: confirmedMn > 0 ? Math.round(confirmedMn * 10) / 10 + " LKR Mn" : "TBC",
    kpiConfirmedNote: confirmedVals.length + " project" + (confirmedVals.length !== 1 ? "s" : "") + " with stated value",
  };
}

// ============ PARTNERS ============
const fmtLkrFull = (n: any) => (n === null || n === undefined || n === "" || isNaN(+n) ? "—" : Number(n).toLocaleString("en-US"));
const partnerStatusClass = (s: string) => {
  const v = String(s || "").trim().toLowerCase();
  if (v.indexOf("board") !== -1) return "status-Ongoing";
  if (v === "new" || v === "prospect") return "status-ToStart";
  return "status-TBC";
};

function buildPartnerRows(list: Partner[], idxOffset: number): string {
  return list
    .map((p, i) => {
      const idx = idxOffset + i;
      const engNames = p.engagements && p.engagements.length
        ? p.engagements.map((e) => `<span class="p-eng-name">${escHtml(e.name)}</span>`).join("")
        : '<span class="p-eng-empty">—</span>';
      const engVals = p.engagements && p.engagements.length
        ? p.engagements.map((e) => `<span class="p-eng-val">${fmtLkrFull(e.value)}</span>`).join("")
        : '<span class="p-eng-empty">—</span>';
      const contactsHtml = p.contacts && p.contacts.length
        ? p.contacts
            .map(
              (c) => `
          <div class="partner-contact-card">
            <div class="partner-contact-role">${escHtml(c.role || "Contact")}</div>
            <div class="partner-contact-name">${c.name ? escHtml(c.name) : '<span class="pcn-empty">Name not provided</span>'}</div>
            <div class="partner-contact-line"><span class="pcl-label">Mobile</span><span class="pcl-value">${c.mobile ? escHtml(c.mobile) : "—"}</span></div>
            <div class="partner-contact-line"><span class="pcl-label">Email</span>${c.email ? `<a href="mailto:${escHtml(c.email)}">${escHtml(c.email)}</a>` : '<span class="pcl-value">—</span>'}</div>
          </div>`
            )
            .join("")
        : '<div class="partner-contact-card"><div class="partner-contact-role">Contacts</div><div class="partner-contact-name"><span class="pcn-empty">No contacts on file</span></div></div>';
      return `
      <tr class="summary-row" data-pidx="${idx}">
        <td><span class="chevron">›</span></td>
        <td class="col-pname">${escHtml(p.name)}</td>
        <td>${escHtml(p.region) || "—"}</td>
        <td><span class="status-pill ${partnerStatusClass(p.status)}">${escHtml(p.status) || "TBC"}</span></td>
        <td class="p-opp-val">${escHtml(p.opportunities) || "—"}</td>
        <td><div class="p-stack">${engNames}</div></td>
        <td><div class="p-stack">${engVals}</div></td>
        <td class="col-ptotal">${fmtLkrFull(p.total)}</td>
      </tr>
      <tr class="detail-row" data-pidx="${idx}" style="display:none;">
        <td colspan="8">
          <div class="detail-content partner-contacts">${contactsHtml}</div>
        </td>
      </tr>
    `;
    })
    .join("");
}

export interface PartnersBuild {
  activeHtml: string; pendingHtml: string;
  emptyActive: boolean; emptyPending: boolean;
  countActive: number; countPending: number;
  totalBadge: string;
  kpiTotalPartners: number; kpiPartnersActive: number; kpiPartnersPending: number; kpiPartnersValue: string;
}

export function buildPartners(allPartners: Partner[]): PartnersBuild {
  const active = allPartners.filter((p) => (p.section || "Active") !== "Pending");
  const pending = allPartners.filter((p) => p.section === "Pending");
  const totalVal = allPartners.reduce((s, p) => s + (Number(p.total) || 0), 0);

  return {
    activeHtml: buildPartnerRows(active, 0),
    pendingHtml: buildPartnerRows(pending, active.length),
    emptyActive: active.length === 0,
    emptyPending: pending.length === 0,
    countActive: active.length,
    countPending: pending.length,
    totalBadge: allPartners.length + " record" + (allPartners.length !== 1 ? "s" : "") + " · click row for contacts",
    kpiTotalPartners: allPartners.length,
    kpiPartnersActive: active.length,
    kpiPartnersPending: pending.length,
    kpiPartnersValue: totalVal > 0 ? (totalVal / 1e6).toFixed(1) : "—",
  };
}

// ============ LEAD GEN WEEKLY + POSITIVE INQUIRIES ============
export function buildLeadGenWeekly(leadGenWeekly: DashboardData["leadGenWeekly"]): { last3Html: string; thisWeekHtml: string; nextWeekHtml: string } {
  const std = (arr: DashboardData["leadGenWeekly"]["last3"]) =>
    arr
      .map(
        (w) =>
          `<tr><td>${escHtml(w.week)}</td><td>${escHtml(w.current) || "0"}</td><td>${escHtml(w.newLeads) || "0"}</td><td>${escHtml(w.active) || "0"}</td><td>${escHtml(w.lost) || "0"}</td><td class="lg-notes">${escHtml(w.notes)}</td></tr>`
      )
      .join("");
  return {
    last3Html: std(leadGenWeekly.last3),
    thisWeekHtml: std(leadGenWeekly.thisWeek),
    nextWeekHtml: leadGenWeekly.nextWeek
      .map((w) => `<tr><td>${escHtml(w.week)}</td><td>${escHtml(w.target) || "0"}</td><td class="lg-notes">${escHtml(w.notes)}</td></tr>`)
      .join(""),
  };
}

export function buildPositiveInquiries(list: PositiveInquiry[]): string {
  if (!list.length) return '<tr><td class="pi-empty" colspan="4">No positive inquiries logged.</td></tr>';
  return list
    .map(
      (r) => `<tr>
      <td class="pi-acct">${r.account ? escHtml(r.account) : '<span class="pi-empty">—</span>'}</td>
      <td>${r.name ? escHtml(r.name) : '<span class="pi-empty">—</span>'}</td>
      <td${r.designation ? "" : ' class="pi-empty"'}>${r.designation ? escHtml(r.designation) : "—"}</td>
      <td${r.email ? "" : ' class="pi-empty"'}>${r.email ? `<a href="mailto:${escHtml(r.email)}" style="color:var(--text);text-decoration:underline;text-underline-offset:2px;">${escHtml(r.email)}</a>` : "—"}</td>
    </tr>`
    )
    .join("");
}

// ============ INTERACTION WIRING (nav / chart toggle / theme / accordions / bar animation) ============
export function setupNav() {
  const navItems = document.querySelectorAll<HTMLElement>(".nav-item[data-view]");
  const views = document.querySelectorAll<HTMLElement>(".view[data-view]");
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const target = item.dataset.view;
      navItems.forEach((n) => n.classList.toggle("active", n === item));
      views.forEach((v) => v.classList.toggle("active", v.dataset.view === target));
      // .main no longer scrolls internally (the sidebar is position:fixed, so
      // the whole page scrolls) — reset window scroll, not main.scrollTop.
      window.scrollTo(0, 0);
    });
  });
}

export function setupChartToggle() {
  const buttons = document.querySelectorAll<HTMLElement>(".chart-toggle button");
  const panels = document.querySelectorAll<HTMLElement>(".chart-panel");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      buttons.forEach((b) => {
        const active = b.dataset.view === view;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", active ? "true" : "false");
      });
      panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === view));
      animateBars();
    });
  });
}

export function setupThemeToggle() {
  const root = document.documentElement;
  const KEY = "octave-dashboard-theme";
  const stored = (() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  })();

  let theme = stored;
  if (!theme) {
    theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  root.setAttribute("data-theme", theme);

  const buttons = document.querySelectorAll<HTMLElement>(".theme-opt[data-theme-set]");
  const syncActive = (active: string) => {
    buttons.forEach((b) => b.classList.toggle("active", b.dataset.themeSet === active));
  };
  syncActive(theme);

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.themeSet;
      if (!next || root.getAttribute("data-theme") === next) return;
      root.setAttribute("data-theme", next);
      syncActive(next);
      try {
        localStorage.setItem(KEY, next);
      } catch {}
    });
  });
}

// Click-to-expand for every accordion table (stage breakdown, projects,
// partners) via a single delegated listener — works regardless of whether
// the rows were server-rendered or inserted later (quarter filter change).
export function setupAccordions() {
  document.addEventListener("click", (e) => {
    const row = (e.target as HTMLElement).closest(".summary-row") as HTMLElement | null;
    if (!row) return;
    const table = row.closest("table");
    if (!table) return;
    if (row.dataset.idx !== undefined) {
      const det = table.querySelector(`.detail-row[data-idx="${row.dataset.idx}"]`) as HTMLElement | null;
      const isOpen = row.classList.toggle("expanded");
      if (det) det.style.display = isOpen ? "" : "none";
    } else if (row.dataset.pidx !== undefined) {
      const det = table.querySelector(`.detail-row[data-pidx="${row.dataset.pidx}"]`) as HTMLElement | null;
      const isOpen = row.classList.toggle("expanded");
      if (det) det.style.display = isOpen ? "" : "none";
    }
  });
}

// Grows every bar rendered with data-w from width:0 to its real width, so
// bars animate in on first paint instead of just appearing at full size.
// Double rAF guarantees the browser has painted the width:0 state first.
export function animateBars() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>("[data-w]").forEach((el) => {
        const w = el.dataset.w;
        if (w) el.style.width = w;
      });
    });
  });
}

export function setupInteractions() {
  setupNav();
  setupChartToggle();
  setupThemeToggle();
  setupAccordions();
}
