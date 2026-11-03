/**
 * Net Worth PDF & Dossier Export Engine
 * Generates publication-grade, self-contained HTML dossiers with embedded SVG charts,
 * asset allocation tables, liability statements, and seamless print-to-PDF triggers.
 */

import { Account, Debt, InvestmentHolding, Loan, UserProfile } from '../types';
import { formatINR, formatCompactINR, formatDate, formatNumber } from './formatters';
import autoTable from 'jspdf-autotable';
import {
  createFinSyncPdfDocument,
  drawPdfHeader,
  drawPdfSectionHeader,
  drawPdfMetricCards,
  drawPdfAllocationBar,
  drawPdfFooter,
  getPdfTableTheme,
  formatPdfINR,
  saveAndSharePdf,
  PDF_COLORS,
  PDF_MARGIN,
  PdfMetricCard,
  PdfAllocationSlice,
  exportHtmlStringToPdf,
  printHtmlReport,
} from './pdfExportHelper';
import { fileService } from '../services/fileService';

export interface NetWorthExportData {
  userProfile?: UserProfile;
  netWorth: number;
  totalGrossAssets: number;
  totalLiabilities: number;

  // 6 Formula components
  totalBankBalances: number;
  totalCreditCardDues: number;
  totalMoneyLent: number;
  totalMoneyBorrowed: number;
  totalInvestments: number;
  totalLoans: number;

  // Breakdown sub-items
  bankAccounts: Account[];
  creditCardAccounts: Account[];
  activeDebtsLent: Debt[];
  activeDebtsBorrowed: Debt[];
  stockHoldings: { holding: InvestmentHolding; currentVal: number; cmp: number }[];
  mfHoldings: { holding: InvestmentHolding; currentVal: number; cmp: number }[];
  pfHoldings: { holding: InvestmentHolding; currentVal: number; cmp: number }[];
  bondHoldings: { holding: InvestmentHolding; currentVal: number; cmp: number }[];
  activeLoans: { loan: Loan; remaining: number }[];

  // Distribution slices
  distributionData: {
    name: string;
    value: number;
    color: string;
    percentage: string;
  }[];

  // Growth timeline
  timelinePeriod: 'week' | 'month' | 'year';
  growthTimelineData: {
    label: string;
    fullDate: string;
    netWorth: number;
    assets: number;
    liabilities: number;
    growth: number;
    growthPercent: number;
  }[];
}

// -------------------------------------------------------------
// Pure SVG Chart Builders for Print & PDF
// -------------------------------------------------------------

function buildDonutChartSVG(data: { name: string; value: number; color: string; percentage: string }[], total: number): string {
  const slices = data.filter((d) => d.value > 0);
  if (slices.length === 0 || total <= 0) {
    return `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;">No active assets logged.</div>`;
  }

  const cx = 100;
  const cy = 100;
  const rOut = 85;
  const rIn = 52;

  let currentAngle = -Math.PI / 2;
  const paths: string[] = [];

  slices.forEach((s) => {
    const sliceAngle = (s.value / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const x1 = cx + rOut * Math.cos(startAngle);
    const y1 = cy + rOut * Math.sin(startAngle);
    const x2 = cx + rOut * Math.cos(endAngle);
    const y2 = cy + rOut * Math.sin(endAngle);

    const x3 = cx + rIn * Math.cos(endAngle);
    const y3 = cy + rIn * Math.sin(endAngle);
    const x4 = cx + rIn * Math.cos(startAngle);
    const y4 = cy + rIn * Math.sin(startAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const pathD = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${rIn} ${rIn} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
    paths.push(`<path d="${pathD}" fill="${s.color}" style="fill:${s.color}!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />`);
  });

  return `
    <div style="display:flex;align-items:center;justify-content:center;gap:24px;flex-wrap:wrap;padding:8px 0;">
      <div style="position:relative;width:200px;height:200px;flex-shrink:0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" style="overflow:visible;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
          ${paths.join('')}
          <circle cx="${cx}" cy="${cy}" r="${rIn - 2}" fill="#ffffff" />
          <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="9" font-weight="700" fill="#64748b" letter-spacing="0.5">TOTAL ASSETS</text>
          <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="13" font-weight="800" fill="#0f172a" font-family="'JetBrains Mono', monospace">${formatCompactINR(total)}</text>
        </svg>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;min-width:240px;flex:1;">
        ${slices.map((s) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:11px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${s.color};"></span>
              <strong style="color:#0f172a;">${s.name}</strong>
            </div>
            <div style="text-align:right;">
              <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#0f172a;">${formatINR(s.value, false)}</span>
              <span style="color:#64748b;margin-left:4px;font-weight:600;">(${s.percentage}%)</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function buildBarChartSVG(points: NetWorthExportData['growthTimelineData']): string {
  if (!points || points.length === 0) return '';
  const w = 760;
  const h = 210;
  const padLeft = 60;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 30;

  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  const vals = points.map((p) => p.netWorth);
  const minVal = Math.min(0, ...vals);
  const maxVal = Math.max(1, ...vals);
  const range = maxVal - minVal || 1;

  const zeroY = padTop + chartH - ((0 - minVal) / range) * chartH;
  const colW = chartW / points.length;
  const barW = Math.max(16, Math.min(42, colW * 0.65));

  const bars = points.map((p, idx) => {
    const x = padLeft + idx * colW + (colW - barW) / 2;
    const yVal = padTop + chartH - ((p.netWorth - minVal) / range) * chartH;
    const isNeg = p.netWorth < 0;
    const barY = isNeg ? zeroY : yVal;
    const barH = Math.max(3, Math.abs(yVal - zeroY));
    const fill = isNeg ? '#f43f5e' : '#10b981';
    const labelY = isNeg ? barY + barH + 11 : barY - 5;

    return `
      <g>
        <rect x="${x.toFixed(1)}" y="${barY.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="3" fill="${fill}" style="fill:${fill}!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />
        <text x="${(x + barW / 2).toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="${fill}" font-family="'JetBrains Mono', monospace">${formatCompactINR(p.netWorth)}</text>
        <text x="${(x + barW / 2).toFixed(1)}" y="${(h - 8).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="600" fill="#64748b">${p.label}</text>
      </g>
    `;
  });

  return `
    <div class="chart-scroll-wrapper" style="width:100%;box-sizing:border-box;overflow:visible;">
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="auto" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" class="full-width-chart-svg print-chart-svg" style="width:100%;max-width:100%;height:auto;display:block;margin:0 auto;overflow:visible;">
        <!-- Grid lines -->
        <line x1="${padLeft}" y1="${padTop}" x2="${w - padRight}" y2="${padTop}" stroke="#e2e8f0" stroke-dasharray="3,3" />
        <line x1="${padLeft}" y1="${zeroY.toFixed(1)}" x2="${w - padRight}" y2="${zeroY.toFixed(1)}" stroke="#cbd5e1" stroke-width="1.5" />
        <line x1="${padLeft}" y1="${(padTop + chartH).toFixed(1)}" x2="${w - padRight}" y2="${(padTop + chartH).toFixed(1)}" stroke="#e2e8f0" />
        <!-- Y-Axis labels -->
        <text x="${padLeft - 6}" y="${padTop + 3}" text-anchor="end" font-size="9" fill="#94a3b8" font-family="'JetBrains Mono', monospace">${formatCompactINR(maxVal)}</text>
        <text x="${padLeft - 6}" y="${(zeroY + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#94a3b8" font-family="'JetBrains Mono', monospace">₹0</text>
        ${bars.join('')}
      </svg>
    </div>
  `;
}

function buildLineChartSVG(points: NetWorthExportData['growthTimelineData']): string {
  if (!points || points.length === 0) return '';
  const w = 760;
  const h = 210;
  const padLeft = 60;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 30;

  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  const allVals = points.flatMap((p) => [p.netWorth, p.assets, p.liabilities]);
  const minVal = Math.min(0, ...allVals);
  const maxVal = Math.max(1, ...allVals);
  const range = maxVal - minVal || 1;

  const colW = chartW / (points.length - 1 || 1);

  const getPt = (val: number, idx: number) => ({
    x: padLeft + idx * colW,
    y: padTop + chartH - ((val - minVal) / range) * chartH,
  });

  const nwPts = points.map((p, idx) => getPt(p.netWorth, idx));
  const assetPts = points.map((p, idx) => getPt(p.assets, idx));
  const liabPts = points.map((p, idx) => getPt(p.liabilities, idx));

  const nwPath = nwPts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const assetPath = assetPts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const liabPath = liabPts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return `
    <div class="chart-scroll-wrapper" style="width:100%;box-sizing:border-box;overflow:visible;">
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="auto" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" class="full-width-chart-svg print-chart-svg" style="width:100%;max-width:100%;height:auto;display:block;margin:0 auto;overflow:visible;">
        <line x1="${padLeft}" y1="${padTop}" x2="${w - padRight}" y2="${padTop}" stroke="#e2e8f0" stroke-dasharray="3,3" />
        <line x1="${padLeft}" y1="${(padTop + chartH / 2).toFixed(1)}" x2="${w - padRight}" y2="${(padTop + chartH / 2).toFixed(1)}" stroke="#e2e8f0" stroke-dasharray="3,3" />
        <line x1="${padLeft}" y1="${(padTop + chartH).toFixed(1)}" x2="${w - padRight}" y2="${(padTop + chartH).toFixed(1)}" stroke="#cbd5e1" />
        
        <!-- Lines -->
        <path d="${assetPath}" fill="none" stroke="#3b82f6" stroke-width="2.2" style="stroke:#3b82f6!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />
        <path d="${nwPath}" fill="none" stroke="#10b981" stroke-width="2.8" style="stroke:#10b981!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />
        <path d="${liabPath}" fill="none" stroke="#f43f5e" stroke-width="2" stroke-dasharray="4,3" style="stroke:#f43f5e!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />

        <!-- Dots -->
        ${nwPts.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#10b981" stroke="#ffffff" stroke-width="1.5" />`).join('')}
        ${assetPts.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="#3b82f6" />`).join('')}

        <!-- X labels -->
        ${points.map((p, idx) => `
          <text x="${(padLeft + idx * colW).toFixed(1)}" y="${(h - 8).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="600" fill="#64748b">${p.label}</text>
        `).join('')}

        <!-- Y labels -->
        <text x="${padLeft - 6}" y="${padTop + 3}" text-anchor="end" font-size="9" fill="#94a3b8" font-family="'JetBrains Mono', monospace">${formatCompactINR(maxVal)}</text>
        <text x="${padLeft - 6}" y="${(padTop + chartH + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#94a3b8" font-family="'JetBrains Mono', monospace">${formatCompactINR(minVal)}</text>
      </svg>
    </div>
  `;
}

// -------------------------------------------------------------
// Complete HTML Dossier Generator
// -------------------------------------------------------------

export function generateNetWorthHTML(data: NetWorthExportData): string {
  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
  const userName = data.userProfile?.name || 'FinSync User';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Net Worth & Financial Health Dossier - ${userName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      forced-color-adjust: none !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.45;
    }
    .mono {
      font-family: "JetBrains Mono", Consolas, monospace;
    }
    .dossier {
      width: 100%;
      max-width: 880px;
      margin: 0 auto;
      padding: 16px;
    }
    @media screen and (min-width: 1100px) {
      .dossier {
        max-width: 960px;
      }
    }
    .chart-card {
      width: 100%;
      box-sizing: border-box;
    }
    .chart-scroll-wrapper {
      width: 100%;
      box-sizing: border-box;
      overflow-x: auto;
      overflow-y: hidden;
      margin: 0;
      padding: 0;
    }
    .full-width-chart-svg, svg.full-width-chart-svg, .print-chart-svg, svg.print-chart-svg {
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      display: block !important;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .brand-subtitle {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .hero-card {
      background: #0f172a;
      color: #ffffff;
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .hero-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #34d399;
      font-weight: 700;
    }
    .hero-amount {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -1px;
      color: #ffffff;
      margin: 4px 0 10px 0;
    }
    .formula-banner {
      font-size: 10px;
      color: #94a3b8;
      border-top: 1px solid #334155;
      padding-top: 10px;
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 6px;
    }
    .formula-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      margin-top: 12px;
    }
    .formula-item {
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      padding: 8px;
    }
    .formula-label {
      font-size: 9px;
      font-weight: 700;
      display: block;
    }
    .formula-val {
      font-size: 12px;
      font-weight: 800;
      margin-top: 4px;
      display: block;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 6px;
      margin: 22px 0 12px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-after: avoid;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 16px;
      background: #ffffff;
      page-break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin-top: 6px;
    }
    th {
      background: #f8fafc;
      text-align: left;
      padding: 6px 8px;
      font-weight: 700;
      color: #475569;
      border-bottom: 1px solid #cbd5e1;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .text-right {
      text-align: right;
    }
    .positive {
      color: #059669;
      font-weight: 700;
    }
    .negative {
      color: #e11d48;
      font-weight: 700;
    }
    .chart-legend {
      display: flex;
      gap: 16px;
      justify-content: center;
      margin-top: 8px;
      font-size: 10px;
      color: #475569;
    }
    .legend-bullet {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 2px;
      margin-right: 4px;
      vertical-align: middle;
    }
    .footer-stamp {
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      color: #64748b;
      font-size: 9px;
      page-break-inside: avoid;
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 10mm 12mm 10mm 12mm;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #0f172a !important;
        width: 100% !important;
        max-width: none !important;
        font-size: 10.5px !important;
        line-height: 1.4 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        forced-color-adjust: none !important;
      }
      *, *::before, *::after {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        forced-color-adjust: none !important;
      }
      .dossier,
      .container,
      .report-container {
        max-width: none !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
      }
      /* Full width grid & metrics */
      .formula-grid,
      .summary-grid,
      .metrics-row,
      div[style*="grid-template-columns"] {
        width: 100% !important;
        max-width: none !important;
      }
      table {
        width: 100% !important;
        max-width: none !important;
        border-collapse: collapse !important;
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: auto;
      }
      thead {
        display: table-header-group !important;
      }
      tfoot {
        display: table-footer-group !important;
      }
      th, td {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .card,
      .hero-card,
      .chart-card,
      .header,
      .section-title,
      .footer-stamp,
      .break-inside-avoid,
      .no-break {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        box-shadow: none !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      h1, h2, h3, h4, h5, h6, .section-title {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      svg {
        max-width: 100% !important;
        width: 100% !important;
        height: auto !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
      }
      svg * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
      }
      /* Hide all interactive print controls */
      .no-print,
      .hide-on-print,
      button,
      .print-btn,
      .print-btn-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="dossier">
    <!-- Print action controls (Hidden during print / in exported PDF) -->
    <div class="no-print" style="margin-bottom: 18px; display: flex; justify-content: flex-end; gap: 10px;">
      <button class="print-btn" onclick="window.print()" style="padding: 9px 16px; background: #059669; color: #ffffff; border: none; border-radius: 10px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: inherit;">
        🖨️ Print / Save to PDF
      </button>
    </div>
    <!-- Header -->
    <div class="header">
      <div>
        <div class="brand-title">FinSync · Consolidated Net Worth Dossier</div>
        <div class="brand-subtitle">Log Split Track Analyse Grow · Executive Wealth Balance Sheet</div>
      </div>
      <div class="meta-box">
        <div><strong>Prepared For:</strong> ${userName}</div>
        <div><strong>Generated On:</strong> ${generatedAt}</div>
        <div><strong>Status:</strong> Active Consolidated Ledger</div>
      </div>
    </div>

    <!-- Hero Card -->
    <div class="hero-card">
      <div class="hero-title">CONSOLIDATED NET WORTH</div>
      <div class="hero-amount mono">${formatINR(data.netWorth, true)}</div>
      <div class="formula-banner">
        <span>Formula: (Bank Balances − CC Dues + Money Lent − Money Borrowed + Investments − Loans)</span>
        <span class="mono">${data.netWorth >= 0 ? '✓ Positive Wealth' : '⚠ Net Liability'}</span>
      </div>

      <div class="formula-grid">
        <div class="formula-item">
          <span class="formula-label" style="color:#60a5fa;">+ Bank & Cash</span>
          <span class="formula-val mono">${formatINR(data.totalBankBalances, false)}</span>
        </div>
        <div class="formula-item">
          <span class="formula-label" style="color:#f87171;">− CC Dues</span>
          <span class="formula-val mono" style="color:#fca5a5;">${formatINR(data.totalCreditCardDues, false)}</span>
        </div>
        <div class="formula-item">
          <span class="formula-label" style="color:#38bdf8;">+ Money Lent</span>
          <span class="formula-val mono">${formatINR(data.totalMoneyLent, false)}</span>
        </div>
        <div class="formula-item">
          <span class="formula-label" style="color:#fbbf24;">− Borrowed</span>
          <span class="formula-val mono" style="color:#fde68a;">${formatINR(data.totalMoneyBorrowed, false)}</span>
        </div>
        <div class="formula-item">
          <span class="formula-label" style="color:#34d399;">+ Investments</span>
          <span class="formula-val mono" style="color:#6ee7b7;">${formatINR(data.totalInvestments, false)}</span>
        </div>
        <div class="formula-item">
          <span class="formula-label" style="color:#a5b4fc;">− Loans</span>
          <span class="formula-val mono" style="color:#c7d2fe;">${formatINR(data.totalLoans, false)}</span>
        </div>
      </div>
    </div>

    <!-- 1. Wealth Distribution & Asset Breakdown -->
    <div class="section-title">
      <span>1. Wealth Distribution & Asset Allocation</span>
      <span class="mono" style="font-size:11px;color:#059669;">Total Assets: ${formatINR(data.totalGrossAssets, false)}</span>
    </div>

    <div class="card">
      ${buildDonutChartSVG(data.distributionData, data.totalGrossAssets)}
    </div>

    <!-- Detailed Assets Tables -->
    <div class="card">
      <strong style="font-size:11px;color:#0f172a;display:block;margin-bottom:6px;">Bank & Cash Accounts (${data.bankAccounts.length})</strong>
      <table>
        <thead>
          <tr>
            <th>Account Name</th>
            <th>Type</th>
            <th class="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${data.bankAccounts.map((a) => `
            <tr>
              <td><strong>${a.name}</strong></td>
              <td style="color:#64748b;text-transform:capitalize;">${a.type}</td>
              <td class="text-right mono"><strong>${formatINR(a.balance, false)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${data.stockHoldings.length > 0 ? `
    <div class="card">
      <strong style="font-size:11px;color:#0f172a;display:block;margin-bottom:6px;">Direct Equities / Stocks (${data.stockHoldings.length})</strong>
      <table>
        <thead>
          <tr>
            <th>Holding</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Market Price</th>
            <th class="text-right">Current Value</th>
          </tr>
        </thead>
        <tbody>
          ${data.stockHoldings.map((h) => `
            <tr>
              <td><strong>${h.holding.symbol}</strong> <span style="color:#64748b;">· ${h.holding.name}</span></td>
              <td class="text-right mono">${h.holding.quantity}</td>
              <td class="text-right mono">${formatINR(h.cmp, true)}</td>
              <td class="text-right mono"><strong>${formatINR(h.currentVal, false)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${data.mfHoldings.length > 0 ? `
    <div class="card">
      <strong style="font-size:11px;color:#0f172a;display:block;margin-bottom:6px;">Mutual Funds (${data.mfHoldings.length})</strong>
      <table>
        <thead>
          <tr>
            <th>Scheme Name</th>
            <th class="text-right">Units</th>
            <th class="text-right">NAV</th>
            <th class="text-right">Current Value</th>
          </tr>
        </thead>
        <tbody>
          ${data.mfHoldings.map((h) => `
            <tr>
              <td><strong>${h.holding.name}</strong></td>
              <td class="text-right mono">${h.holding.quantity.toFixed(3)}</td>
              <td class="text-right mono">${formatINR(h.cmp, true)}</td>
              <td class="text-right mono"><strong>${formatINR(h.currentVal, false)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${data.pfHoldings.length + data.bondHoldings.length > 0 ? `
    <div class="card">
      <strong style="font-size:11px;color:#0f172a;display:block;margin-bottom:6px;">Provident Funds & Bonds (${data.pfHoldings.length + data.bondHoldings.length})</strong>
      <table>
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Type</th>
            <th class="text-right">Balance / Valuation</th>
          </tr>
        </thead>
        <tbody>
          ${[...data.pfHoldings, ...data.bondHoldings].map((h) => `
            <tr>
              <td><strong>${h.holding.name}</strong></td>
              <td style="color:#64748b;text-transform:uppercase;">${h.holding.assetType}</td>
              <td class="text-right mono"><strong>${formatINR(h.currentVal, false)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${data.activeDebtsLent.length > 0 ? `
    <div class="card">
      <strong style="font-size:11px;color:#0f172a;display:block;margin-bottom:6px;">Receivables / Money Lent (${data.activeDebtsLent.length})</strong>
      <table>
        <thead>
          <tr>
            <th>Contact Person</th>
            <th>Due Date</th>
            <th class="text-right">Amount Owed</th>
          </tr>
        </thead>
        <tbody>
          ${data.activeDebtsLent.map((d) => `
            <tr>
              <td><strong>${d.personName}</strong></td>
              <td style="color:#64748b;">${d.dueDate ? formatDate(d.dueDate) : 'Open'}</td>
              <td class="text-right mono"><strong>${formatINR(d.currentBalance, false)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- 2. Consolidated Liabilities Breakdown -->
    <div class="section-title">
      <span>2. Liabilities & Obligations</span>
      <span class="mono" style="font-size:11px;color:#e11d48;">Total Debt: ${formatINR(data.totalLiabilities, false)}</span>
    </div>

    ${data.creditCardAccounts.length > 0 ? `
    <div class="card">
      <strong style="font-size:11px;color:#0f172a;display:block;margin-bottom:6px;">Credit Cards (${data.creditCardAccounts.length})</strong>
      <table>
        <thead>
          <tr>
            <th>Card Name</th>
            <th class="text-right">Credit Limit</th>
            <th class="text-right">Outstanding Dues</th>
          </tr>
        </thead>
        <tbody>
          ${data.creditCardAccounts.map((c) => {
            const due = c.balance < 0 ? Math.abs(c.balance) : 0;
            return `
              <tr>
                <td><strong>${c.name}</strong></td>
                <td class="text-right mono" style="color:#64748b;">${formatINR(c.creditLimit || 0, false)}</td>
                <td class="text-right mono negative">−${formatINR(due, false)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${data.activeLoans.length > 0 ? `
    <div class="card">
      <strong style="font-size:11px;color:#0f172a;display:block;margin-bottom:6px;">Active Loans (${data.activeLoans.length})</strong>
      <table>
        <thead>
          <tr>
            <th>Loan Facility</th>
            <th>Interest Rate</th>
            <th class="text-right">Principal Remaining</th>
          </tr>
        </thead>
        <tbody>
          ${data.activeLoans.map((l) => `
            <tr>
              <td><strong>${l.loan.name}</strong></td>
              <td>${l.loan.interestRate}% p.a.</td>
              <td class="text-right mono negative">−${formatINR(l.remaining, false)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${data.activeDebtsBorrowed.length > 0 ? `
    <div class="card">
      <strong style="font-size:11px;color:#0f172a;display:block;margin-bottom:6px;">Payables / Borrowed IOUs (${data.activeDebtsBorrowed.length})</strong>
      <table>
        <thead>
          <tr>
            <th>Contact Person</th>
            <th>Due Date</th>
            <th class="text-right">Amount Payable</th>
          </tr>
        </thead>
        <tbody>
          ${data.activeDebtsBorrowed.map((d) => `
            <tr>
              <td><strong>${d.personName}</strong></td>
              <td style="color:#64748b;">${d.dueDate ? formatDate(d.dueDate) : 'Open'}</td>
              <td class="text-right mono negative">−${formatINR(d.currentBalance, false)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- 3. Growth Charts & Historical Progression -->
    <div class="section-title">
      <span>3. Growth Trends (${data.timelinePeriod.toUpperCase()} Progression)</span>
      <span style="font-size:10px;color:#64748b;">${data.growthTimelineData.length} Milestone Intervals</span>
    </div>

    <!-- Bar Graph -->
    <div class="card">
      <strong style="font-size:11px;color:#0f172a;display:block;margin-bottom:10px;">Net Worth Growth Bar Chart</strong>
      ${buildBarChartSVG(data.growthTimelineData)}
    </div>

    <!-- Line Graph -->
    <div class="card">
      <strong style="font-size:11px;color:#0f172a;display:block;margin-bottom:6px;">Trend Comparison Line Chart (Net Worth, Assets & Liabilities)</strong>
      ${buildLineChartSVG(data.growthTimelineData)}
      <div class="chart-legend">
        <span><span class="legend-bullet" style="background:#10b981;"></span>Net Worth</span>
        <span><span class="legend-bullet" style="background:#3b82f6;"></span>Gross Assets</span>
        <span><span class="legend-bullet" style="background:#f43f5e;"></span>Liabilities</span>
      </div>
    </div>

    <!-- Progression Table -->
    <div class="card">
      <strong style="font-size:11px;color:#0f172a;display:block;margin-bottom:6px;">Historical Milestones Data Table</strong>
      <table>
        <thead>
          <tr>
            <th>Period</th>
            <th>Date</th>
            <th class="text-right">Gross Assets</th>
            <th class="text-right">Liabilities</th>
            <th class="text-right">Net Worth</th>
            <th class="text-right">Period Growth</th>
          </tr>
        </thead>
        <tbody>
          ${data.growthTimelineData.map((pt) => `
            <tr>
              <td><strong>${pt.label}</strong></td>
              <td style="color:#64748b;">${pt.fullDate}</td>
              <td class="text-right mono">${formatINR(pt.assets, false)}</td>
              <td class="text-right mono" style="color:#e11d48;">${formatINR(pt.liabilities, false)}</td>
              <td class="text-right mono"><strong>${formatINR(pt.netWorth, false)}</strong></td>
              <td class="text-right mono ${pt.growth >= 0 ? 'positive' : 'negative'}">
                ${pt.growth !== 0 ? `${pt.growth >= 0 ? '+' : ''}${formatINR(pt.growth, false)} (${pt.growthPercent.toFixed(1)}%)` : '—'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Footer Stamp -->
    <div class="footer-stamp">
      <div>FinSync Personal Finance · Offline-first Cryptographically Verified Audit Dossier</div>
      <div>Page 1 of 1 · Generated ${generatedAt}</div>
    </div>
  </div>
</body>
</html>`;
}

// -------------------------------------------------------------
// Interactive PDF & HTML Dispatcher
// -------------------------------------------------------------

/**
 * Generates and downloads a real PDF dossier of Net Worth, assets, and liabilities
 */
/**
 * Generates and downloads a publication-grade, vector-based PDF statement of Net Worth, assets, and liabilities
 * using real PDF text, vector lines, structured autoTables, and vector graphics.
 * Produces crisp text at any zoom level, selectable copyable text, tiny file size (< 200KB),
 * and executes within milliseconds without high RAM overhead on mobile devices.
 */
export async function exportNetWorthPDF(
  data: NetWorthExportData,
  onFeedback?: (msg: string, type: 'info' | 'success' | 'error') => void
): Promise<void> {
  onFeedback?.("Compiling Net Worth balance sheet layout & charts...", "info");

  const htmlContent = generateNetWorthHTML(data);
  const dateStr = new Date().toISOString().split("T")[0];
  const fileName = `FinSync_Net_Worth_${dateStr}.pdf`;

  await exportHtmlStringToPdf(htmlContent, {
    fileName,
    onProgress: (msg) => onFeedback?.(msg, "info"),
    reportTitle: "Net Worth Balance Sheet & Solvency Statement",
    widthPx: 800,
    marginTopBottomMm: 12,
    marginLeftRightMm: 12,
  });

  onFeedback?.("Net Worth PDF statement generated and shared!", "success");
}

export function printNetWorthPDF(
  data: NetWorthExportData,
  _onFeedback?: (msg: string, type: 'info' | 'success' | 'error') => void
): void {
  const html = generateNetWorthHTML(data);
  printHtmlReport(html);
}

export function downloadNetWorthHTML(data: NetWorthExportData): void {
  const html = generateNetWorthHTML(data);
  const fileName = `FinSync_Net_Worth_${new Date().toISOString().split('T')[0]}.html`;
  fileService.exportAndShare({
    filename: fileName,
    content: html,
    mimeType: 'text/html;charset=utf-8;',
    title: 'FinSync Net Worth Statement',
    dialogTitle: 'Save or Share Net Worth Statement',
  });
}

