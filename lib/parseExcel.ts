// Isomorphic Excel parser — runs in the browser (drag-and-drop preview on
// /upload) and would work equally well server-side. Ported field-for-field
// from index.html's original loadExcelFile(); the parsing rules here are the
// spec — do not change them without checking the source workbook layout.
import * as XLSX from "xlsx";

export interface Deal {
  id: string | number;
  name: string;
  co: string;
  stage: string;
  source: string;
  value: number;
  close: string;
  won: boolean;
  lost: boolean;
}

export interface StageQuarter {
  Inquiry: number;
  Exploration: number;
  "POC/Demo": number;
  Proposal: number;
  Negotiations: number;
  Contracted: number;
  Lost: number;
  Morphed: number;
  total: number;
}

export interface BmQuarterRaw {
  displayLabel: string;
  lastUpdated: string;
  totalDeals: number;
  revQtdTarget: number | string | null;
  revQtdCurrent: number | string | null;
  newClientsTarget: number | string | null;
  newClientsCurrent: number | string | null;
  closedDealsTarget: number | string | null;
  closedDealsCurrent: number | string | null;
  billedQtdTarget: number | string | null;
  billedQtdCurrent: number | string | null;
  revYtdTarget: number | string | null;
  revYtdCurrent: number | string | null;
  billedYtdTarget: number | string | null;
  billedYtdCurrent: number | string | null;
  budgetAlloc: number | string | null;
  budgetSpend: number | string | null;
  utilization: number | string | null;
  costPerInquiry: number | string | null;
  costPerAcq: number | string | null;
  costPerRev: number | string | null;
  revMtdTarget: number | string | null;
  newClientsMtdTarget: number | string | null;
  closedDealsMtdTarget: number | string | null;
  billedMtdTarget: number | string | null;
  accountsTarget: number | string | null;
  contactedTarget: number | string | null;
  repliesTarget: number | string | null;
  positiveTarget: number | string | null;
}

export interface Channel {
  name: string;
  accounts: number;
  contacted: number;
  replies: number;
  positive: number;
}

export interface Project {
  client: string;
  project: string;
  type: string;
  value: string;
  milestone: string;
  date: string;
  invoice: string | number;
  planned: string | number;
  actual: string | number;
  next: string;
  status: "Ongoing" | "To Start" | "TBC";
}

export interface PartnerEngagement {
  name: string;
  value: number | null;
}

export interface PartnerContact {
  role: string;
  name: string;
  mobile: string;
  email: string;
}

export interface Partner {
  name: string;
  region: string;
  status: string;
  opportunities: string;
  engagements: PartnerEngagement[];
  total: number | null;
  contacts: PartnerContact[];
  section: "Active" | "Pending";
}

export interface PositiveInquiry {
  account: string | null;
  name: string | null;
  designation: string | null;
  email: string | null;
}

export interface LeadGenWeekRow {
  week: string;
  current: string;
  newLeads: string;
  active: string;
  lost: string;
  notes: string;
}

export interface LeadGenNextWeekRow {
  week: string;
  target: string;
  notes: string;
}

export interface DashboardData {
  deals: Deal[];
  dealStageCounts: Record<string, number>;
  dealTotal: number;
  stagesByQuarter: Record<string, StageQuarter>;
  bmByQuarter: Record<string, BmQuarterRaw>;
  channelsByQuarter: Record<string, Channel[]>;
  projects: Project[];
  partners: Partner[];
  positiveInquiries: PositiveInquiry[];
  leadGenWeekly: {
    last3: LeadGenWeekRow[];
    thisWeek: LeadGenWeekRow[];
    nextWeek: LeadGenNextWeekRow[];
  };
  // ISO timestamp of when this dataset was actually committed via /upload —
  // stamped server-side in /api/update-data, not read from any spreadsheet
  // cell. This is what the sidebar's "Data as of" reflects. Absent on data
  // that predates this field (falls back to "—" in the UI).
  updatedAt?: string;
}

const EMPTY_STAGE_COUNTS = (): Record<string, number> => ({
  Inquiry: 0,
  Exploration: 0,
  "POC/Demo": 0,
  Proposal: 0,
  Negotiations: 0,
  Contracted: 0,
  Lost: 0,
  Morphed: 0,
});

export function parseWorkbook(input: ArrayBuffer | Uint8Array | Buffer): DashboardData {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input as ArrayBuffer);
  const wb = XLSX.read(data, { type: "array", cellDates: true });

  const sheetRows = (name: string): any[][] => {
    const ws = wb.Sheets[name];
    if (!ws) return [];
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
  };

  // ---- Deals ----
  const dealRows = sheetRows("Deals").slice(1).filter((r) => r[0]);
  const deals: Deal[] = dealRows.map((r) => ({
    id: r[0],
    name: r[1] || "",
    co: r[2] || "",
    stage: r[3] || "",
    source: r[4] || "",
    value: parseFloat(r[5]) || 0,
    close: r[6] ? (r[6] instanceof Date ? r[6].toISOString().slice(0, 10) : String(r[6]).slice(0, 10)) : "",
    won: r[7] === true || String(r[7]).toLowerCase() === "true",
    lost: r[8] === true || String(r[8]).toLowerCase() === "true",
  }));

  const dealStageCounts = EMPTY_STAGE_COUNTS();
  deals.forEach((d) => {
    if (Object.prototype.hasOwnProperty.call(dealStageCounts, d.stage)) dealStageCounts[d.stage]++;
  });
  const dealTotal = deals.length;

  // ---- Deal Stages ----
  const stageRows = sheetRows("Deal Stages").slice(1).filter((r) => r[0]);
  const stagesByQuarter: Record<string, StageQuarter> = {};
  stageRows.forEach((r) => {
    stagesByQuarter[r[0]] = {
      Inquiry: +r[1] || 0,
      Exploration: +r[2] || 0,
      "POC/Demo": +r[3] || 0,
      Proposal: +r[4] || 0,
      Negotiations: +r[5] || 0,
      Contracted: +r[6] || 0,
      Lost: +r[7] || 0,
      Morphed: +r[8] || 0,
      total: +r[9] || 0,
    };
  });

  // ---- Business Metrics ----
  const bmRows = sheetRows("Business Metrics").slice(1).filter((r) => r[0]);
  const bmByQuarter: Record<string, BmQuarterRaw> = {};
  bmRows.forEach((r) => {
    const qcode = r[0];
    if (!qcode) return;
    const lastUpd = r[2];
    let lastUpdStr = "—";
    if (lastUpd instanceof Date) {
      lastUpdStr = lastUpd.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } else if (lastUpd) {
      lastUpdStr = String(lastUpd).slice(0, 10);
    }
    bmByQuarter[qcode] = {
      displayLabel: r[1] || qcode,
      lastUpdated: lastUpdStr,
      totalDeals: +r[3] || 0,
      revQtdTarget: r[4], revQtdCurrent: r[5],
      newClientsTarget: r[6], newClientsCurrent: r[7],
      closedDealsTarget: r[8], closedDealsCurrent: r[9],
      billedQtdTarget: r[10], billedQtdCurrent: r[11],
      revYtdTarget: r[12], revYtdCurrent: r[13],
      billedYtdTarget: r[14], billedYtdCurrent: r[15],
      budgetAlloc: r[16], budgetSpend: r[17],
      utilization: r[18],
      costPerInquiry: r[19], costPerAcq: r[20], costPerRev: r[21],
      revMtdTarget: r[22], newClientsMtdTarget: r[23], closedDealsMtdTarget: r[24], billedMtdTarget: r[25],
      accountsTarget: r[26], contactedTarget: r[27], repliesTarget: r[28], positiveTarget: r[29],
    };
  });

  // ---- Lead Channels ----
  const lcRows = sheetRows("Lead Channels").slice(1).filter((r) => r[0]);
  const channelsByQuarter: Record<string, Channel[]> = {};
  lcRows.forEach((r) => {
    const qcode = r[0];
    if (!channelsByQuarter[qcode]) channelsByQuarter[qcode] = [];
    if (r[1]) {
      channelsByQuarter[qcode].push({
        name: r[1], accounts: +r[2] || 0, contacted: +r[3] || 0,
        replies: +r[4] || 0, positive: +r[5] || 0,
      });
    }
  });

  // ---- Projects ----
  const normStatus = (s: any): Project["status"] => {
    const v = String(s || "").trim().toLowerCase();
    if (v === "current" || v === "ongoing") return "Ongoing";
    if (v === "active" || v === "to start") return "To Start";
    return "TBC";
  };
  const fmtProjValue = (v: any): string => {
    if (v === null || v === undefined || v === "" || String(v).trim().toUpperCase() === "TBC") return "TBC";
    const num = typeof v === "number" ? v : (/^[0-9,.]+$/.test(String(v).trim()) ? parseFloat(String(v).replace(/,/g, "")) : NaN);
    return isNaN(num) ? String(v) : "LKR " + num.toLocaleString();
  };
  const projRows = sheetRows("Projects").slice(1).filter((r) => {
    const c = String(r[0] || "").trim();
    if (!c) return false;
    if (c.charAt(0) === "▸" || /^(current|active|pending)$/i.test(c)) return false;
    return !!String(r[1] || "").trim();
  });
  const projects: Project[] = projRows.map((r) => ({
    client: String(r[0] || "").trim(),
    project: String(r[1] || "").trim(),
    type: String(r[2] || "TBC").trim(),
    value: fmtProjValue(r[4]),
    milestone: String(r[5] || "TBC").trim(),
    date: String(r[6] || "TBC").trim(),
    invoice: r[7] || "TBC",
    planned: r[8] || "TBC",
    actual: r[9] || "TBC",
    next: r[10] || "",
    status: normStatus(r[3]),
  }));

  // ---- Partners ----
  // Flat layout, one partner per starting row (col B = Name):
  //   A Section(Active/Pending)  B Name  C Region  D Status  E No. of Opportunity
  //   F Engagement  G Value  H Total  I Primary contact  J Mobile  K Email
  //   L Secondary contact  M Mobile  N Email
  // Extra engagement rows sit directly below with only F (+G/H) filled and B blank.
  const partners: Partner[] = [];
  const partnerSheetName = wb.SheetNames.find((n) => /partner/i.test(n));
  if (partnerSheetName) {
    const prows = sheetRows(partnerSheetName).slice(1);
    const pnum = (v: any): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
      return isNaN(n) ? null : n;
    };
    const ptxt = (v: any): string => (v === null || v === undefined ? "" : String(v).trim());
    let section: "Active" | "Pending" = "Active";
    let current: Partner | null = null;
    prows.forEach((r) => {
      const a = ptxt(r[0]);
      if (/^active/i.test(a)) section = "Active";
      else if (/^pending/i.test(a)) section = "Pending";
      const name = ptxt(r[1]);
      const f = ptxt(r[5]);
      const g = r[6];
      const h = r[7];
      if (name) {
        current = {
          name, region: ptxt(r[2]), status: ptxt(r[3]), opportunities: ptxt(r[4]),
          engagements: [], total: pnum(h), contacts: [], section,
        };
        if (f) current.engagements.push({ name: f, value: pnum(g) });
        const pName = ptxt(r[8]), pMob = ptxt(r[9]), pEmail = ptxt(r[10]);
        if (pName || pMob || pEmail) current.contacts.push({ role: "Primary Contact", name: pName, mobile: pMob, email: pEmail });
        const sName = ptxt(r[11]), sMob = ptxt(r[12]), sEmail = ptxt(r[13]);
        if (sName || sMob || sEmail) current.contacts.push({ role: "Secondary Contact", name: sName, mobile: sMob, email: sEmail });
        partners.push(current);
        return;
      }
      if (!current) return;
      if (f) {
        current.engagements.push({ name: f, value: pnum(g) });
        if (pnum(h) !== null && current.total === null) current.total = pnum(h);
      }
    });
  }

  // ---- Positive Inquiries ----
  const positiveInquiries: PositiveInquiry[] = [];
  const posSheetName = wb.SheetNames.find((n) => /positive\s*inquir/i.test(n));
  if (posSheetName) {
    const cellTxt = (v: any): string | null => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());
    const rows = sheetRows(posSheetName).slice(1).filter((r) => (r[0] != null && String(r[0]).trim()) || (r[1] != null && String(r[1]).trim()));
    rows.forEach((r) => {
      positiveInquiries.push({
        account: cellTxt(r[0]), name: cellTxt(r[1]), designation: cellTxt(r[2]), email: cellTxt(r[3]),
      });
    });
  }

  // ---- Lead Gen Weekly ----
  // Section markers in col A ("LAST 3 WEEKS" / "THIS WEEK" / "NEXT WEEK"); each
  // followed by a header row then data rows whose col A begins with "Week".
  const leadGenWeekly: DashboardData["leadGenWeekly"] = { last3: [], thisWeek: [], nextWeek: [] };
  const lgSheet = wb.SheetNames.find((n) => /lead\s*gen\s*weekly/i.test(n));
  if (lgSheet) {
    const rows = sheetRows(lgSheet);
    const txt = (v: any): string => (v === null || v === undefined ? "" : String(v).trim());
    let section: "last3" | "this" | "next" | null = null;
    rows.forEach((r) => {
      const a = txt(r[0]);
      if (/last\s*3\s*weeks/i.test(a)) { section = "last3"; return; }
      if (/this\s*week/i.test(a)) { section = "this"; return; }
      if (/next\s*week/i.test(a)) { section = "next"; return; }
      if (/positive\s*inquir/i.test(a)) { section = null; return; }
      if (!section) return;
      if (!/^week\b/i.test(a)) return;
      if (/^week$/i.test(a)) return;
      if (section === "last3") leadGenWeekly.last3.push({ week: a, current: txt(r[1]), newLeads: txt(r[2]), active: txt(r[3]), lost: txt(r[4]), notes: txt(r[5]) });
      else if (section === "this") leadGenWeekly.thisWeek.push({ week: a, current: txt(r[1]), newLeads: txt(r[2]), active: txt(r[3]), lost: txt(r[4]), notes: txt(r[5]) });
      else if (section === "next") leadGenWeekly.nextWeek.push({ week: a, target: txt(r[1]), notes: txt(r[5]) });
    });
  }

  return {
    deals, dealStageCounts, dealTotal, stagesByQuarter, bmByQuarter,
    channelsByQuarter, projects, partners, positiveInquiries, leadGenWeekly,
  };
}

// ============ DISPLAY-READY BUSINESS METRICS ============
// Turns the raw per-quarter sheet data into the shape the Business Metrics
// view renders directly (targets/currents/% deltas). Ported from the
// newBmData derivation inside the original loadExcelFile().

export interface BmMetric {
  name: string;
  baseline: string;
  mtd?: string;
  target?: string;
  current: string;
  pctRaw: number | null;
}

export interface BmStageCard {
  name: string;
  count: number;
  color: string;
}

export interface BmQuarterDisplay {
  displayLabel: string;
  titleDate: string;
  subtitle: string;
  vsLabel: string;
  lastUpdated: string;
  business: BmMetric[];
  leadGen: BmMetric[];
  ytd: BmMetric[];
  totalDeals: number;
  budget: { allocation: number | null; spend: number | null };
  stated: {
    utilization: number | string | null;
    costPerInquiry: number | string | null;
    costPerAcq: number | string | null;
    costPerRev: number | string | null;
  };
  stages: BmStageCard[];
  channels: Channel[];
}

const STAGE_COLORS: Record<string, string> = {
  Inquiry: "#FFC9EA", Exploration: "#F77FCC", "POC/Demo": "#E82AAE",
  Proposal: "#C71B91", Negotiations: "#9E1474", Contracted: "#26EA9F",
  Lost: "#7A7A88", Morphed: "#3F3F4A",
};

const safeNum = (v: any): number | null => (v === null || v === undefined || v === "" || isNaN(+v) ? null : +v);
const safePct = (cur: any, tgt: any): number | null => {
  const c = safeNum(cur), t = safeNum(tgt);
  if (c === null || t === null || t === 0) return null;
  return (c - t) / t;
};
const orDash = (v: any): string => (v === null || v === undefined || v === "" ? "—" : String(v));

export function buildBmDataByQuarter(d: DashboardData): Record<string, BmQuarterDisplay> {
  const stageColorList = Object.entries(STAGE_COLORS).map(([name, color]) => ({ name, color }));
  const out: Record<string, BmQuarterDisplay> = {};

  Object.keys(d.bmByQuarter).forEach((qcode) => {
    const bm = d.bmByQuarter[qcode];
    const stg = d.stagesByQuarter[qcode];
    const ch = d.channelsByQuarter[qcode] || [];
    const totalDeals = bm.totalDeals || 0;
    // For the active quarter (the one carrying deals), derive stage counts + total
    // from the granular Deals tab so they match the Overview; otherwise use the summary tab.
    const useDeals = totalDeals > 0 && d.dealTotal > 0;
    const effStages: Record<string, number> = useDeals ? d.dealStageCounts : (stg as any) || EMPTY_STAGE_COUNTS();
    const effTotal = useDeals ? d.dealTotal : totalDeals;

    out[qcode] = {
      displayLabel: bm.displayLabel,
      titleDate: bm.lastUpdated,
      subtitle: "",
      vsLabel: "vs QTD target",
      lastUpdated: bm.lastUpdated,
      business: [
        { name: "Revenue (LKR Mn)", baseline: String(bm.revQtdTarget ?? "—"), mtd: orDash(bm.revMtdTarget), target: String(bm.revQtdTarget ?? "—"), current: String(bm.revQtdCurrent ?? "—"), pctRaw: safePct(bm.revQtdCurrent, bm.revQtdTarget) },
        { name: "New Clients", baseline: String(bm.newClientsTarget ?? "—"), mtd: orDash(bm.newClientsMtdTarget), target: String(bm.newClientsTarget ?? "—"), current: String(bm.newClientsCurrent ?? "—"), pctRaw: safePct(bm.newClientsCurrent, bm.newClientsTarget) },
        { name: "Closed Deals", baseline: String(bm.closedDealsTarget ?? "—"), mtd: orDash(bm.closedDealsMtdTarget), target: String(bm.closedDealsTarget ?? "—"), current: String(bm.closedDealsCurrent ?? "—"), pctRaw: safePct(bm.closedDealsCurrent, bm.closedDealsTarget) },
        { name: "Billed (LKR Mn)", baseline: String(bm.billedQtdTarget ?? "—"), mtd: orDash(bm.billedMtdTarget), target: String(bm.billedQtdTarget ?? "—"), current: String(bm.billedQtdCurrent ?? "—"), pctRaw: safePct(bm.billedQtdCurrent, bm.billedQtdTarget) },
      ],
      leadGen: (() => {
        const sumA = ch.reduce((s, c) => s + c.accounts, 0);
        const sumC = ch.reduce((s, c) => s + c.contacted, 0);
        const sumR = ch.reduce((s, c) => s + c.replies, 0);
        const sumP = ch.reduce((s, c) => s + c.positive, 0);
        const lb = (t: any, actual: number) => (t === null || t === undefined || t === "" ? String(actual) : String(t));
        return [
          { name: "No. of Accounts", baseline: lb(bm.accountsTarget, sumA), current: String(sumA), pctRaw: null },
          { name: "Clients Contacted", baseline: lb(bm.contactedTarget, sumC), current: String(sumC), pctRaw: null },
          { name: "Replies Received", baseline: lb(bm.repliesTarget, sumR), current: String(sumR), pctRaw: null },
          { name: "Positive Inquiry", baseline: lb(bm.positiveTarget, sumP), current: String(sumP), pctRaw: null },
        ];
      })(),
      ytd: [
        { name: "Revenue YTD (LKR Mn)", baseline: String(bm.revYtdTarget ?? "—"), current: String(bm.revYtdCurrent ?? "—"), pctRaw: safePct(bm.revYtdCurrent, bm.revYtdTarget) },
        { name: "Billed YTD (LKR Mn)", baseline: String(bm.billedYtdTarget ?? "—"), current: String(bm.billedYtdCurrent ?? "—"), pctRaw: safePct(bm.billedYtdCurrent, bm.billedYtdTarget) },
      ],
      totalDeals: effTotal,
      budget: { allocation: safeNum(bm.budgetAlloc), spend: safeNum(bm.budgetSpend) },
      stated: {
        utilization: bm.utilization,
        costPerInquiry: bm.costPerInquiry,
        costPerAcq: bm.costPerAcq,
        costPerRev: bm.costPerRev,
      },
      stages: stageColorList.map((sc) => ({ name: sc.name, count: effStages[sc.name] || 0, color: sc.color })),
      channels: ch,
    };
  });

  return out;
}
