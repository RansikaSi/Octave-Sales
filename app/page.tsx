"use client";

import { useEffect } from "react";
import seedData from "@/data/data.json";
import type { DashboardData } from "@/lib/parseExcel";
import { buildBmDataByQuarter } from "@/lib/parseExcel";
import {
  buildOverview,
  buildBusinessMetrics,
  buildProjects,
  buildPartners,
  buildLeadGenWeekly,
  buildPositiveInquiries,
  mountBusinessMetrics,
  setupInteractions,
  animateBars,
} from "@/lib/renderDashboard";

// Everything below is computed once, at module scope, from the statically
// imported data.json — not inside a useEffect. That means the server-rendered
// HTML (and the hydrated client HTML) already contains real numbers, chart
// bars, and table rows on the very first paint. No flash from placeholder
// "—" values to real ones. Only the Business Metrics section needs a runtime
// re-render (the quarter filter) — see mountBusinessMetrics() in the effect
// below. Bars are rendered at width:0 with a data-w target and grown in by
// animateBars() post-mount instead of appearing at full size instantly.
const dashboardData = seedData as unknown as DashboardData;
const bmDataByQuarter = buildBmDataByQuarter(dashboardData);
const initialQuarter = Object.keys(bmDataByQuarter)[0] || "";

const overview = buildOverview(dashboardData.deals);
const bm = initialQuarter ? buildBusinessMetrics(bmDataByQuarter, initialQuarter) : null;
const projects = buildProjects(dashboardData.projects);
const partners = buildPartners(dashboardData.partners);
const leadGen = buildLeadGenWeekly(dashboardData.leadGenWeekly);
const posInqHtml = buildPositiveInquiries(dashboardData.positiveInquiries);
const wordmarkDateText = bm?.lastUpdated ? `Data as of ${bm.lastUpdated}` : "—";
const quarterOptionsHtml = Object.keys(bmDataByQuarter)
  .map((q) => `<option value="${q}">${bmDataByQuarter[q]?.displayLabel || q}</option>`)
  .join("");

const DASHBOARD_HTML = `
  <aside class="sidebar">
    <div class="brand-block">
      <div class="wordmark">
        <span class="wordmark-dot"></span>OCTAVE
      </div>
      <div class="wordmark-sub">Sales Intelligence</div>
      <div class="wordmark-date" id="wordmarkDate">${wordmarkDateText}</div>
    </div>

    <div class="nav-item active" data-view="overview">
      <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/></svg>
      Pipeline Overview
    </div>
    <div class="nav-item" data-view="business-metrics">
      <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 13l4-4 3 3 5-6"/><path d="M10 6h4v4"/></svg>
      Business Metrics
    </div>
    <div class="nav-item" data-view="projects">
      <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 4l6-2 6 2v8l-6 2-6-2V4z"/><path d="M8 2v12M2 4l6 2 6-2"/></svg>
      Projects
    </div>
    <div class="nav-item" data-view="partners">
      <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="5.5" cy="6" r="2.2"/><circle cx="11" cy="6.5" r="1.8"/><path d="M2 13c0-2 1.6-3.3 3.5-3.3S9 11 9 13"/><path d="M9.6 9.9c1.6 0 2.9 1.2 2.9 3.1"/></svg>
      Partners
    </div>
    <div class="nav-item" data-view="glossary">
      <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M5 5h6M5 7.5h6M5 10h4"/></svg>
      Glossary
    </div>

    <div class="theme-switch" role="group" aria-label="Color theme">
      <button type="button" class="theme-opt" data-theme-set="light" aria-label="Use light theme">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <circle cx="8" cy="8" r="3"/>
          <path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"/>
        </svg>
        <span>Light</span>
      </button>
      <button type="button" class="theme-opt" data-theme-set="dark" aria-label="Use dark theme">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z"/>
        </svg>
        <span>Dark</span>
      </button>
    </div>

    <div style="padding: 0 22px 0; margin-bottom: 4px;">
      <a href="/upload" style="
        display: flex; align-items: center; gap: 9px;
        padding: 10px 14px;
        background: var(--octave-pink-soft);
        border: 1px solid rgba(232,42,174,0.35);
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 700;
        color: var(--octave-pink);
        letter-spacing: 0.04em;
        text-decoration: none;
      ">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <path d="M3 12h10M8 3v7M5 7l3-4 3 4"/>
        </svg>
        Update Data
      </a>
    </div>

    <div class="sidebar-foot">
      <div class="pwr">
        Powered by<br>
        <b>OCTAVE Analytics</b>
      </div>
    </div>
  </aside>

  <main class="main">

    <!-- ============ VIEW: OVERVIEW ============ -->
    <div class="view active" data-view="overview">

    <div class="topbar">
      <div>
        <h1>Pipeline Overview</h1>
        <p>HubSpot CRM — pipeline, deal stage progression &amp; revenue performance</p>
      </div>
      <div class="filters">
        <div class="filter">
          <span class="filter-label">Date Range</span>
          <select>
            <option>Mar 2025 – Jul 2026</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>YTD 2026</option>
          </select>
        </div>
        <div class="filter">
          <span class="filter-label">Stage</span>
          <select>
            <option>All Stages</option>
            <option>Inquiry</option>
            <option>Exploration</option>
            <option>POC/Demo</option>
            <option>Proposal</option>
            <option>Negotiations</option>
            <option>Contracted</option>
          </select>
        </div>
        <div class="filter">
          <span class="filter-label">Owner</span>
          <select>
            <option>All Owners</option>
            <option>Rohan J.</option>
            <option>Kimaya Kariyawasam</option>
          </select>
        </div>
        <button class="btn-reset">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 8a6 6 0 1 1 2 4.5M2 13v-4h4"/></svg>
          Reset Filters
        </button>
      </div>
    </div>

    <div class="kpi-band">
      <div class="kpi-band-label">Key Performance Indicators</div>
      <div class="kpi-grid">

        <div class="kpi">
          <div class="kpi-row">
            <div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6"/><path d="M8 5v6M5.5 7.5l2.5-2.5 2.5 2.5"/></svg></div>
            <div class="kpi-label">Active Leads</div>
          </div>
          <div class="kpi-value">${overview.kpis.active}</div>
        </div>

        <div class="kpi">
          <div class="kpi-row">
            <div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="12" height="10"/><path d="M5 3V2M11 3V2M2 6h12"/></svg></div>
            <div class="kpi-label">Total Deals</div>
          </div>
          <div class="kpi-value">${overview.kpis.total}</div>
        </div>

        <div class="kpi">
          <div class="kpi-row">
            <div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12L6 8L9 11L14 5"/><path d="M10 5h4v4"/></svg></div>
            <div class="kpi-label"># of Deals Won</div>
          </div>
          <div class="kpi-value">${overview.kpis.won}</div>
        </div>

        <div class="kpi">
          <div class="kpi-row">
            <div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3l10 10M13 3L3 13"/></svg></div>
            <div class="kpi-label">Closed Lost</div>
          </div>
          <div class="kpi-value">${overview.kpis.closedLost}</div>
        </div>

        <div class="kpi">
          <div class="kpi-row">
            <div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6"/><path d="M5 8l2 2 4-4"/></svg></div>
            <div class="kpi-label">Win Rate</div>
          </div>
          <div class="kpi-value">${overview.kpis.winRate}</div>
        </div>

      </div>
    </div>

    <div class="row" style="grid-template-columns: 1fr; margin-bottom: 6px;">
      <h2 class="bm-section-title" style="margin-bottom: 0;">Lead Generation Effort</h2>
    </div>
    <div class="leadgen-stack">

      <div class="card">
        <div class="card-head">
          <div class="card-title">Last 3 Weeks</div>
        </div>
        <table class="leadgen-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Current Leads</th>
              <th>This Week New Leads</th>
              <th>This Week Active Leads</th>
              <th>This Week Lost Leads</th>
              <th class="lg-notes">Notes</th>
            </tr>
          </thead>
          <tbody id="lgLast3Body">${leadGen.last3Html}</tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title">This Week</div>
        </div>
        <table class="leadgen-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Current Leads</th>
              <th>This Week New Leads</th>
              <th>This Week Active Leads</th>
              <th>This Week Lost Leads</th>
              <th class="lg-notes">Notes</th>
            </tr>
          </thead>
          <tbody id="lgThisWeekBody">${leadGen.thisWeekHtml}</tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title">Next Week</div>
        </div>
        <table class="leadgen-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>New Leads Target</th>
              <th class="lg-notes">Notes</th>
            </tr>
          </thead>
          <tbody id="lgNextWeekBody">${leadGen.nextWeekHtml}</tbody>
        </table>
      </div>

    </div>

    <div class="row row-a">

      <div class="card">
        <div class="card-head">
          <div class="card-title">Deals by Stage</div>
          <div class="chart-toggle" role="tablist" aria-label="Toggle between count and value">
            <button type="button" class="active" data-view="count" role="tab" aria-selected="true">Count</button>
            <button type="button" data-view="value" role="tab" aria-selected="false">Value</button>
          </div>
        </div>

        <div class="chart-panel active" data-panel="count">
          <div class="funnel" id="funnel">${overview.funnelHtml}</div>
        </div>

        <div class="chart-panel" data-panel="value">
          <div style="font-size:10px;color:var(--text-mute);letter-spacing:0.04em;margin-bottom:10px;text-transform:uppercase;font-weight:700;">LKR · excl. Morphed outlier</div>
          <div class="stage-value" id="stageValue">${overview.stageValueHtml}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title">Pipeline Composition</div>
          <div class="card-badge">by count</div>
        </div>
        <div class="donut-wrap">
          <svg class="donut-svg" width="230" height="230" viewBox="0 0 230 230">
            <g id="donut" transform="translate(115 115)">${overview.donutPathsHtml}</g>
            <text x="115" y="106" text-anchor="middle" fill="currentColor" style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.5;">Total</text>
            <text id="donutTotal" x="115" y="134" text-anchor="middle" fill="currentColor" style="font-family:'Century Gothic', sans-serif;font-size:34px;font-weight:700;">${overview.donutTotal}</text>
          </svg>
          <div class="donut-legend" id="donutLegend">${overview.donutLegendHtml}</div>
        </div>
      </div>

    </div>

    <div class="row" style="grid-template-columns: 1fr;">

      <div class="card">
        <div class="card-head">
          <div class="card-title">Deal Stages by Source</div>
          <div class="card-badge">count · by acquisition channel</div>
        </div>
        <div id="sourceChart" class="source-chart">${overview.sourceChartHtml}</div>
        <div id="sourceLegend" class="source-legend">${overview.sourceLegendHtml}</div>
      </div>

    </div>

    <div class="row" style="grid-template-columns: 1fr;">

      <div class="card" style="padding: 0; overflow: hidden;">
        <div class="card-head" style="padding: 18px 20px 0; margin-bottom: 12px;">
          <div class="card-title">Deals by Stage Breakdown</div>
        </div>
        <div class="table-wrap">
          <table class="stage-breakdown-table">
            <colgroup>
              <col class="sb-chev"/>
              <col class="sb-stage"/>
              <col class="sb-count"/>
              <col class="sb-value"/>
            </colgroup>
            <thead>
              <tr>
                <th></th>
                <th>Stage</th>
                <th>Deals</th>
                <th>Value (LKR)</th>
              </tr>
            </thead>
            <tbody id="stageBreakdownBody">${overview.stageBreakdownHtml}</tbody>
          </table>
        </div>
      </div>

    </div>

    <div class="footer-note">
      <div>
        <span class="info-icon">i</span>
        All revenue in LKR. The LKR 40M AACO deal under Morphed is treated as a non-cash transformation and excluded from value-scaled charts so the rest stay readable.
      </div>
      <div class="src">Source: HubSpot CRM Export</div>
    </div>

    </div>
    <!-- /VIEW: OVERVIEW -->

    <!-- ============ VIEW: BUSINESS METRICS ============ -->
    <div class="view" data-view="business-metrics">

      <div class="topbar">
        <div>
          <h1>Business Metrics</h1>
          <div class="bm-last-updated">
            <span class="bm-last-updated-label">Last updated</span>
            <span id="bmLastUpdated">${bm?.lastUpdated ?? "—"}</span>
          </div>
        </div>
        <div class="bm-controls">
          <div class="filter bm-quarter-filter">
            <span class="filter-label">Quarter</span>
            <select id="quarterFilter">${quarterOptionsHtml}</select>
          </div>
          <div class="bm-legend">
            <div class="bm-legend-row"><span class="bm-legend-swatch above"></span><span>Above target</span></div>
            <div class="bm-legend-row"><span class="bm-legend-swatch below"></span><span>Below target</span></div>
            <div class="bm-legend-divider"></div>
            <div class="bm-legend-key">
              <div><b>Target</b> quarter target</div>
              <div><b>Current</b> as of last update</div>
              <div><b>% change</b> vs target</div>
            </div>
          </div>
        </div>
      </div>

      <section class="bm-section bm-ytd-top">
        <div class="bm-section-head">
          <h2 class="bm-section-title">Year to date</h2>
          <div class="bm-section-badge">strategic</div>
        </div>
        <div class="bm-cards bm-ytd-cards" id="bmYtdCards">${bm?.ytdCardsHtml ?? ""}</div>
      </section>

      <section class="bm-section">
        <div class="bm-section-head">
          <h2 class="bm-section-title">Business Performance</h2>
          <div class="bm-section-badge">weekly · this week vs last</div>
        </div>
        <div class="bm-cards" id="bmBusinessCards">${bm?.businessCardsHtml ?? ""}</div>
      </section>

      <section class="bm-section">
        <div class="bm-section-head">
          <h2 class="bm-section-title">Deals by Stage</h2>
          <div class="bm-section-badge" id="bmStageBadge">${bm?.stageBadge ?? "snapshot"}</div>
        </div>
        <div class="bm-stage-cards" id="bmStageCards">${bm?.stageCardsHtml ?? ""}</div>
      </section>

      <section class="bm-section">
        <div class="bm-section-head">
          <h2 class="bm-section-title">Lead Generation Performance</h2>
          <div class="bm-section-badge">summed across channels</div>
        </div>
        <div class="bm-cards" id="bmLeadCards">${bm?.leadCardsHtml ?? ""}</div>

        <div class="bm-channel-table-wrap">
          <table class="channel-table">
            <colgroup>
              <col class="cc-channel"/>
              <col class="cc-num"/>
              <col class="cc-num"/>
              <col class="cc-num"/>
              <col class="cc-num"/>
              <col class="cc-rate"/>
            </colgroup>
            <thead>
              <tr>
                <th>Channel</th>
                <th class="tcol-num">Accounts</th>
                <th class="tcol-num">Contacted</th>
                <th class="tcol-num">Inquiry Received</th>
                <th class="tcol-num">Positive</th>
                <th>Reply Rate</th>
              </tr>
            </thead>
            <tbody id="channelTableBody">${bm?.channelTableHtml ?? ""}</tbody>
          </table>
        </div>

        <div class="pos-inq-wrap">
          <div class="pos-inq-title">Positive Inquiries List</div>
          <div class="bm-channel-table-wrap">
            <table class="channel-table pos-inq-table">
              <colgroup>
                <col class="pi-account"/>
                <col class="pi-name"/>
                <col class="pi-designation"/>
                <col class="pi-email"/>
              </colgroup>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Name</th>
                  <th>Designation</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody id="posInquiryBody">${posInqHtml}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="bm-section">
        <div class="bm-section-head">
          <h2 class="bm-section-title">Budget Utilization Illustrative</h2>
          <div class="bm-section-badge">marketing spend tracking</div>
        </div>
        <div class="bm-simple-cards" id="bmBudgetCards">${bm?.budgetCardsHtml ?? ""}</div>
      </section>

      <section class="bm-section">
        <div class="bm-section-head">
          <h2 class="bm-section-title">Cost Efficiency</h2>
          <div class="bm-section-badge">derived · auto-calculated from spend</div>
        </div>
        <div class="bm-simple-cards" id="bmCostCards">${bm?.costCardsHtml ?? ""}</div>
      </section>

      <div class="footer-note" style="margin-top: 24px;">
        <div>
          <span class="info-icon">i</span>
          Lead Generation metrics have no prior-period target in the source sheet — % change shown as "—".
        </div>
        <div class="src">Source sheet: Business Metrics</div>
      </div>

    </div>
    <!-- /VIEW: BUSINESS METRICS -->

    <!-- ============ VIEW: PROJECTS ============ -->
    <div class="view" data-view="projects">

      <div class="topbar">
        <div>
          <h1>Projects &amp; Billing</h1>
          <p>Active engagements — delivery status, billing milestones &amp; next steps</p>
        </div>
      </div>

      <div class="kpi-band">
        <div class="kpi-band-label">Project Portfolio</div>
        <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr);">

          <div class="kpi" style="border-right: 1px solid var(--border);">
            <div class="kpi-row">
              <div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 4l6-2 6 2v8l-6 2-6-2V4z"/></svg></div>
              <div class="kpi-label">Active Projects</div>
            </div>
            <div class="kpi-value" id="kpiActiveProjects">${projects.kpiActiveProjects}</div>
            <div class="kpi-compare">across all client accounts</div>
          </div>

          <div class="kpi" style="border-right: 1px solid var(--border);">
            <div class="kpi-row">
              <div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6"/><path d="M5 8l2 2 4-4"/></svg></div>
              <div class="kpi-label">Ongoing</div>
            </div>
            <div class="kpi-value" id="kpiOngoing">${projects.kpiOngoing}</div>
            <div class="kpi-compare">projects in progress</div>
          </div>

          <div class="kpi" style="border-right: 1px solid var(--border);">
            <div class="kpi-row">
              <div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg></div>
              <div class="kpi-label">To Start</div>
            </div>
            <div class="kpi-value" id="kpiToStart">${projects.kpiToStart}</div>
            <div class="kpi-compare">projects pending kick-off</div>
          </div>

          <div class="kpi">
            <div class="kpi-row">
              <div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12L6 8L9 11L14 5"/><path d="M10 5h4v4"/></svg></div>
              <div class="kpi-label">Confirmed Value (LKR Mn)</div>
            </div>
            <div class="kpi-value" id="kpiConfirmedValue">${projects.kpiConfirmedValue}</div>
            <div class="kpi-compare" id="kpiConfirmedNote">${projects.kpiConfirmedNote}</div>
          </div>

        </div>
      </div>

      <div class="card" style="padding: 0; overflow: hidden;">
        <div class="card-head" style="padding: 18px 20px 0; margin-bottom: 12px;">
          <div class="card-title">All Projects</div>
          <div class="card-badge" id="projTotalBadge">${projects.totalBadge}</div>
        </div>

        <div class="proj-section-header">
          <span class="proj-section-title">Current</span>
          <span class="proj-section-count" id="countCurrent">${projects.countOngoing}</span>
        </div>
        <div class="table-wrap">
          <table class="projects-table no-top-border">
            <colgroup>
              <col class="c-chev"/>
              <col class="c-client"/>
              <col class="c-project"/>
              <col class="c-type"/>
              <col class="c-next"/>
            </colgroup>
            <thead>
              <tr>
                <th></th>
                <th>Client</th>
                <th>Project</th>
                <th>Type</th>
                <th>Next Steps</th>
              </tr>
            </thead>
            <tbody id="bodyOngoing" style="${projects.emptyOngoing ? "display:none;" : ""}">${projects.ongoingHtml}</tbody>
          </table>
          <div class="proj-section-empty" id="emptyOngoing" style="${projects.emptyOngoing ? "" : "display:none;"}">No ongoing projects.</div>
        </div>

        <div class="proj-section-header">
          <span class="proj-section-title">Active</span>
          <span class="proj-section-count" id="countToStart">${projects.countToStart}</span>
        </div>
        <div class="table-wrap">
          <table class="projects-table no-top-border">
            <colgroup>
              <col class="c-chev"/>
              <col class="c-client"/>
              <col class="c-project"/>
              <col class="c-type"/>
              <col class="c-next"/>
            </colgroup>
            <thead>
              <tr>
                <th></th>
                <th>Client</th>
                <th>Project</th>
                <th>Type</th>
                <th>Next Steps</th>
              </tr>
            </thead>
            <tbody id="bodyToStart" style="${projects.emptyToStart ? "display:none;" : ""}">${projects.toStartHtml}</tbody>
          </table>
          <div class="proj-section-empty" id="emptyToStart" style="${projects.emptyToStart ? "" : "display:none;"}">No projects to start.</div>
        </div>

        <div class="proj-section-header">
          <span class="proj-section-title">Pending</span>
          <span class="proj-section-count" id="countTBC">${projects.countTbc}</span>
        </div>
        <div class="table-wrap">
          <table class="projects-table no-top-border">
            <colgroup>
              <col class="c-chev"/>
              <col class="c-client"/>
              <col class="c-project"/>
              <col class="c-type"/>
              <col class="c-next"/>
            </colgroup>
            <thead>
              <tr>
                <th></th>
                <th>Client</th>
                <th>Project</th>
                <th>Type</th>
                <th>Next Steps</th>
              </tr>
            </thead>
            <tbody id="bodyTBC" style="${projects.emptyTbc ? "display:none;" : ""}">${projects.tbcHtml}</tbody>
          </table>
          <div class="proj-section-empty" id="emptyTBC" style="${projects.emptyTbc ? "" : "display:none;"}">No pending projects.</div>
        </div>
      </div>

      <div class="footer-note" style="margin-top: 20px;">
        <div>
          <span class="info-icon">i</span>
          "TBC" entries are pending confirmation. Values shown in muted text. Source sheet: <i>Project overview and billing</i>.
        </div>
      </div>

    </div>
    <!-- /VIEW: PROJECTS -->

    <!-- ============ VIEW: PARTNERS ============ -->
    <div class="view" data-view="partners">

      <div class="topbar">
        <div>
          <h1>Partners</h1>
          <p>Channel &amp; delivery partners — engagements, pipeline value &amp; contacts</p>
        </div>
      </div>

      <div class="kpi-band">
        <div class="kpi-band-label">Partner Portfolio</div>
        <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr);">

          <div class="kpi" style="border-right: 1px solid var(--border);">
            <div class="kpi-row">
              <div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="5.5" cy="6" r="2.2"/><circle cx="11" cy="6.5" r="1.8"/><path d="M2 13c0-2 1.6-3.3 3.5-3.3S9 11 9 13"/></svg></div>
              <div class="kpi-label">Total Partners</div>
            </div>
            <div class="kpi-value" id="kpiTotalPartners">${partners.kpiTotalPartners}</div>
            <div class="kpi-compare">across all regions</div>
          </div>

          <div class="kpi" style="border-right: 1px solid var(--border);">
            <div class="kpi-row">
              <div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6"/><path d="M5 8l2 2 4-4"/></svg></div>
              <div class="kpi-label">On Board</div>
            </div>
            <div class="kpi-value" id="kpiPartnersActive">${partners.kpiPartnersActive}</div>
            <div class="kpi-compare">active partners</div>
          </div>

          <div class="kpi" style="border-right: 1px solid var(--border);">
            <div class="kpi-row">
              <div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg></div>
              <div class="kpi-label">Pending</div>
            </div>
            <div class="kpi-value" id="kpiPartnersPending">${partners.kpiPartnersPending}</div>
            <div class="kpi-compare">partners in pipeline</div>
          </div>

          <div class="kpi">
            <div class="kpi-row">
              <div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12L6 8L9 11L14 5"/><path d="M10 5h4v4"/></svg></div>
              <div class="kpi-label">Total Value (LKR Mn)</div>
            </div>
            <div class="kpi-value" id="kpiPartnersValue">${partners.kpiPartnersValue}</div>
            <div class="kpi-compare" id="kpiPartnersValueNote">combined engagement value</div>
          </div>

        </div>
      </div>

      <div class="card" style="padding: 0; overflow: hidden;">
        <div class="card-head" style="padding: 18px 20px 0; margin-bottom: 12px;">
          <div class="card-title">All Partners</div>
          <div class="card-badge" id="partnerTotalBadge">${partners.totalBadge}</div>
        </div>

        <div class="proj-section-header">
          <span class="proj-section-title">Active</span>
          <span class="proj-section-count" id="countPartnersActive">${partners.countActive}</span>
        </div>
        <div class="table-wrap">
          <table class="projects-table partners-table no-top-border">
            <colgroup>
              <col class="p-chev"/>
              <col class="p-name"/>
              <col class="p-region"/>
              <col class="p-status"/>
              <col class="p-opp"/>
              <col class="p-engage"/>
              <col class="p-value"/>
              <col class="p-total"/>
            </colgroup>
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Primary Region</th>
                <th>Status</th>
                <th>No. of Opportunity</th>
                <th>Engagements</th>
                <th>Value (LKR)</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody id="bodyPartnersActive" style="${partners.emptyActive ? "display:none;" : ""}">${partners.activeHtml}</tbody>
          </table>
          <div class="proj-section-empty" id="emptyPartnersActive" style="${partners.emptyActive ? "" : "display:none;"}">No active partners.</div>
        </div>

        <div class="proj-section-header">
          <span class="proj-section-title">Pending</span>
          <span class="proj-section-count" id="countPartnersPending">${partners.countPending}</span>
        </div>
        <div class="table-wrap">
          <table class="projects-table partners-table no-top-border">
            <colgroup>
              <col class="p-chev"/>
              <col class="p-name"/>
              <col class="p-region"/>
              <col class="p-status"/>
              <col class="p-opp"/>
              <col class="p-engage"/>
              <col class="p-value"/>
              <col class="p-total"/>
            </colgroup>
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Primary Region</th>
                <th>Status</th>
                <th>No. of Opportunity</th>
                <th>Engagements</th>
                <th>Value (LKR)</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody id="bodyPartnersPending" style="${partners.emptyPending ? "display:none;" : ""}">${partners.pendingHtml}</tbody>
          </table>
          <div class="proj-section-empty" id="emptyPartnersPending" style="${partners.emptyPending ? "" : "display:none;"}">No pending partners.</div>
        </div>
      </div>

      <div class="footer-note" style="margin-top: 20px;">
        <div>
          <span class="info-icon">i</span>
          Click any partner row to reveal primary &amp; secondary contact details. Source sheet: <i>Partners</i>.
        </div>
      </div>

    </div>
    <!-- /VIEW: PARTNERS -->

    <!-- ============ VIEW: GLOSSARY ============ -->
    <div class="view" data-view="glossary">
      <div class="topbar">
        <div>
          <h1>Glossary</h1>
          <p>Definitions for all terms, metrics, and stages used across this dashboard.</p>
        </div>
      </div>

      <div class="glossary-wrap">

        <div class="glossary-section">
          <h2 class="glossary-section-title">Deals by Stage</h2>
          <div class="glossary-table">
            <div class="glossary-row glossary-header">
              <div>Term</div>
              <div>Definition</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Inquiry</div>
              <div class="glossary-def">A prospect has expressed initial interest but has not yet been qualified for fit or intent.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Exploration</div>
              <div class="glossary-def">An active discovery conversation to qualify the prospect's need, budget, authority, and timeline.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">POC / DEMO</div>
              <div class="glossary-def">The prospect is evaluating the solution through a live demonstration or proof of concept.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Proposal</div>
              <div class="glossary-def">A formal commercial and/or technical proposal has been submitted, outlining the proposed solution, scope, pricing, timelines, and terms.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Negotiations</div>
              <div class="glossary-def">Active discussion between both parties to align on commercial terms, scope, and conditions prior to contract signing.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Contracted</div>
              <div class="glossary-def">The prospect has signed an agreement and the deal is officially closed and won.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Lost</div>
              <div class="glossary-def">The opportunity has been disqualified or the prospect has chosen not to proceed or selected a competitor.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Morphed</div>
              <div class="glossary-def">The prospect is no longer interested in pursuing the deal due to internal or external reasons, with no path forward at this time.</div>
            </div>
          </div>
        </div>

        <div class="glossary-section">
          <h2 class="glossary-section-title">Key Performance Indicators</h2>
          <div class="glossary-table">
            <div class="glossary-row glossary-header">
              <div>Term</div>
              <div>Definition</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Active Pipeline</div>
              <div class="glossary-def">The total value of all open opportunities currently progressing through the sales pipeline, excluding closed or inactive deals.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Total Deals</div>
              <div class="glossary-def">The total number of opportunities created within a defined period, regardless of stage or outcome.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Closed (Won)</div>
              <div class="glossary-def">The number or value of opportunities that have successfully progressed through the sales process and resulted in a signed agreement or confirmed sale.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Closed Lost</div>
              <div class="glossary-def">The number or value of opportunities that were not converted into sales and have been formally closed as unsuccessful.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Win Rate</div>
              <div class="glossary-def">The percentage of opportunities won out of the total closed opportunities. Calculated as: Closed Won / (Closed Won + Closed Lost) × 100.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Avg Deal Size</div>
              <div class="glossary-def">The average revenue value generated per won opportunity. Calculated as: Total Revenue from Closed Won Deals / Number of Closed Won Deals.</div>
            </div>
          </div>
        </div>

        <div class="glossary-section">
          <h2 class="glossary-section-title">Deal Sources</h2>
          <div class="glossary-table">
            <div class="glossary-row glossary-header">
              <div>Term</div>
              <div>Definition</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Referral — OCTAVE Staff</div>
              <div class="glossary-def">Opportunity generated through a direct introduction or recommendation made by an internal OCTAVE team member.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Referral — Non OCTAVE</div>
              <div class="glossary-def">Opportunity generated through a recommendation or introduction made by an external party, such as a partner, vendor, or industry contact.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Existing Client — Cross-sell</div>
              <div class="glossary-def">Opportunity identified within a current client account to introduce an additional product or service that complements their existing engagement.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">LinkedIn</div>
              <div class="glossary-def">Opportunity generated through prospecting, content engagement, or outreach conducted via the LinkedIn platform.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Existing Client — Upsell</div>
              <div class="glossary-def">Opportunity identified within a current client account to expand or upgrade their existing product or service to a higher value offering.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Direct</div>
              <div class="glossary-def">Opportunity initiated through direct outreach by the sales team, including cold calls, emails, or in-person approaches, with no intermediary or referral.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Website</div>
              <div class="glossary-def">Opportunity generated through an inbound enquiry submitted via the company website, such as a contact form, chat, or content download.</div>
            </div>
          </div>
        </div>

        <div class="glossary-section">
          <h2 class="glossary-section-title">Business Performance</h2>
          <div class="glossary-table">
            <div class="glossary-row glossary-header">
              <div>Term</div>
              <div>Definition</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Revenue QTD Target (LKR Mn)</div>
              <div class="glossary-def">The planned revenue to be recognised within the current quarter, set at the start of the quarter as a performance benchmark.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Revenue QTD Current (LKR Mn)</div>
              <div class="glossary-def">The actual revenue recognised from the start of the current quarter to the reporting date.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">New Clients Target</div>
              <div class="glossary-def">The number of net-new client relationships the team aims to secure within the current quarter.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">New Clients Current</div>
              <div class="glossary-def">The number of net-new client relationships successfully contracted from the start of the current quarter to the reporting date.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Closed Deals Target</div>
              <div class="glossary-def">The number of deals targeted to reach Contracted status within the current quarter.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Closed Deals Current</div>
              <div class="glossary-def">The number of deals that have reached Contracted status from the start of the current quarter to the reporting date.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Billed QTD Target (LKR Mn)</div>
              <div class="glossary-def">The planned invoiced amount to be raised to clients within the current quarter.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Billed QTD Current (LKR Mn)</div>
              <div class="glossary-def">The total value of invoices actually raised to clients from the start of the current quarter to the reporting date.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Revenue YTD Target (LKR Mn)</div>
              <div class="glossary-def">The cumulative revenue target from the start of the financial year to the end of the current quarter.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Revenue YTD Current (LKR Mn)</div>
              <div class="glossary-def">The cumulative revenue actually recognised from the start of the financial year to the reporting date.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Billed YTD Target (LKR Mn)</div>
              <div class="glossary-def">The cumulative invoiced amount targeted from the start of the financial year to the end of the current quarter.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Billed YTD Current (LKR Mn)</div>
              <div class="glossary-def">The cumulative value of all invoices raised from the start of the financial year to the reporting date.</div>
            </div>
          </div>
        </div>

        <div class="glossary-section">
          <h2 class="glossary-section-title">Budget Utilization</h2>
          <div class="glossary-table">
            <div class="glossary-row glossary-header">
              <div>Term</div>
              <div>Definition</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Budget Allocation (LKR Mn)</div>
              <div class="glossary-def">The total sales and marketing budget approved for the quarter, covering all spend categories including campaigns, events, tools, and headcount costs.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Budget Spend (LKR Mn)</div>
              <div class="glossary-def">The actual amount spent against the approved quarterly budget to the reporting date.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Utilization %</div>
              <div class="glossary-def">The percentage of the approved quarterly budget that has been spent. Calculated as: Budget Spend / Budget Allocation × 100.</div>
            </div>
          </div>
        </div>

        <div class="glossary-section">
          <h2 class="glossary-section-title">Cost Utilization</h2>
          <div class="glossary-table">
            <div class="glossary-row glossary-header">
              <div>Term</div>
              <div>Definition</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Cost per Inquiry</div>
              <div class="glossary-def">The average cost incurred to generate a single inquiry. Calculated as: Budget Spend / Number of Inquiries in the quarter.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Cost per Acquisition</div>
              <div class="glossary-def">The average cost incurred to close a single contracted deal. Calculated as: Budget Spend / Number of Contracted Deals in the quarter.</div>
            </div>
            <div class="glossary-row">
              <div class="glossary-term">Cost per Revenue</div>
              <div class="glossary-def">The sales and marketing cost as a proportion of revenue recognised. Calculated as: Budget Spend / Revenue QTD Current.</div>
            </div>
          </div>
        </div>

      </div>
    </div>
    <!-- /VIEW: GLOSSARY -->

  </main>
`;

export default function DashboardPage() {
  useEffect(() => {
    setupInteractions();
    animateBars();

    const quarterFilterEl = document.getElementById("quarterFilter");
    const wordmarkDateEl = document.getElementById("wordmarkDate");
    const onQuarterChange = (e: Event) => {
      const q = (e.target as HTMLSelectElement).value;
      mountBusinessMetrics(bmDataByQuarter, q);
      if (wordmarkDateEl) {
        const lastUpdated = bmDataByQuarter[q]?.lastUpdated;
        wordmarkDateEl.textContent = lastUpdated ? `Data as of ${lastUpdated}` : "—";
      }
    };
    quarterFilterEl?.addEventListener("change", onQuarterChange);

    return () => {
      quarterFilterEl?.removeEventListener("change", onQuarterChange);
    };
  }, []);

  return <div className="app" dangerouslySetInnerHTML={{ __html: DASHBOARD_HTML }} />;
}
