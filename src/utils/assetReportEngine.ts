import { InvestmentHolding, InvestmentTransaction } from '../types';
import { computePfMetrics, computeBondMetrics, computeSgbMetrics } from './bondsSgbPfEngine';
import { formatINR, formatDate, toInputDate, formatCompactINR } from './formatters';

/**
 * Builds a clean SVG Profit/Loss Bar Chart matching Export Analysis standards
 */
function buildProfitLossBarChartSVG(holdings: InvestmentHolding[]): string {
  if (!holdings || holdings.length === 0) return '';

  const items = holdings.map((h) => {
    let val = 0;
    let inv = 0;
    if (h.assetType === 'pf') {
      const m = computePfMetrics(h);
      val = m.totalCorpusBalance;
      inv = m.totalEmployeeContributions + m.totalEmployerContributions + m.totalVoluntaryContributions + (h.openingBalance || 0) - m.totalWithdrawals;
    } else if (h.assetType === 'bond') {
      const m = computeBondMetrics(h);
      val = m.currentValuation + m.totalInterestReceived;
      inv = m.totalInvested;
    } else if (h.assetType === 'sgb') {
      const m = computeSgbMetrics(h);
      val = m.currentValuation;
      inv = m.totalInvested;
    } else {
      val = h.quantity * (h.currentPrice || h.averageBuyPrice);
      inv = h.quantity * h.averageBuyPrice;
    }
    return {
      symbol: h.symbol,
      invested: Math.max(0, inv),
      valuation: Math.max(0, val),
    };
  }).slice(0, 8); // Top 8 holdings for clean chart rendering

  const maxVal = Math.max(...items.map((i) => Math.max(i.invested, i.valuation)), 1);
  const w = 720;
  const h = 220;
  const padL = 50;
  const padR = 20;
  const padT = 30;
  const padB = 40;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const baselineY = padT + chartH;
  const groupW = chartW / items.length;

  let barsHtml = '';

  items.forEach((p, idx) => {
    const barX = padL + idx * groupW + groupW * 0.15;
    const barWidth = groupW * 0.7;
    const isProfit = p.valuation >= p.invested;

    const investedHeight = Math.max(0, (p.invested / maxVal) * chartH);
    const investedTopY = baselineY - investedHeight;
    const valuationHeight = Math.max(0, (p.valuation / maxVal) * chartH);
    const valuationTopY = baselineY - valuationHeight;

    if (isProfit) {
      const profitHeight = Math.max(0, ((p.valuation - p.invested) / maxVal) * chartH);
      const profitTopY = valuationTopY;

      barsHtml += `
        <g>
          <text x="${barX + barWidth / 2}" y="${profitTopY - 6}" text-anchor="middle" font-size="9" font-weight="700" fill="#059669" class="mono">${formatCompactINR(p.valuation)}</text>
          ${investedHeight > 0 ? `<rect x="${barX}" y="${investedTopY}" width="${barWidth}" height="${investedHeight}" fill="#2563eb" rx="2" />` : ''}
          ${profitHeight > 0 ? `<rect x="${barX}" y="${profitTopY}" width="${barWidth}" height="${profitHeight}" fill="#10b981" stroke="#047857" stroke-width="1.5" rx="2" />` : ''}
          <text x="${barX + barWidth / 2}" y="${baselineY + 14}" text-anchor="middle" font-size="9" font-weight="600" fill="#475569">${p.symbol}</text>
        </g>
      `;
    } else {
      const lossHeight = Math.max(0, investedHeight - valuationHeight);
      barsHtml += `
        <g>
          <text x="${barX + barWidth / 2}" y="${valuationTopY - 6}" text-anchor="middle" font-size="9" font-weight="700" fill="#dc2626" class="mono">${formatCompactINR(p.valuation)}</text>
          <rect x="${barX}" y="${investedTopY}" width="${barWidth}" height="${investedHeight}" fill="#2563eb" rx="2" />
          <rect x="${barX}" y="${valuationTopY}" width="${barWidth}" height="${valuationHeight}" fill="#2563eb" rx="2" />
          <rect x="${barX}" y="${valuationTopY}" width="${barWidth}" height="${lossHeight}" fill="#ef4444" opacity="0.3" rx="2" />
          <text x="${barX + barWidth / 2}" y="${baselineY + 14}" text-anchor="middle" font-size="9" font-weight="600" fill="#475569">${p.symbol}</text>
        </g>
      `;
    }
  });

  return `
  <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px; margin-bottom: 18px;">
    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 2px;">
      Portfolio Growth & Profit/Loss Bar Analytics
    </div>
    <div style="font-size: 10px; color: #64748b; margin-bottom: 12px;">
      Blue = Invested Capital · Green = Realized/Unrealized Profit · Red = Loss
    </div>
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="auto" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
      <line x1="${padL}" y1="${baselineY}" x2="${w - padR}" y2="${baselineY}" stroke="#cbd5e1" stroke-width="1.5" />
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${baselineY}" stroke="#cbd5e1" stroke-width="1.5" />
      ${barsHtml}
    </svg>
  </div>`;
}

/**
 * Generates an SVG Asset Allocation Donut Chart matching Export Analysis standards
 */
function buildAssetAllocationDonutSVG(holdings: InvestmentHolding[]): string {
  if (!holdings || holdings.length === 0) return '';

  const map: Record<string, number> = {};
  let totalVal = 0;

  holdings.forEach((h) => {
    let val = 0;
    if (h.assetType === 'pf') {
      const m = computePfMetrics(h);
      val = m.totalCorpusBalance;
    } else if (h.assetType === 'bond') {
      const m = computeBondMetrics(h);
      val = m.currentValuation;
    } else if (h.assetType === 'sgb') {
      const m = computeSgbMetrics(h);
      val = m.currentValuation;
    } else {
      val = h.quantity * (h.currentPrice || h.averageBuyPrice);
    }
    const cat = h.assetType === 'stock' ? 'Stocks' : h.assetType === 'mutual_fund' ? 'Mutual Funds' : h.assetType === 'bond' ? 'Bonds' : h.assetType === 'sgb' ? 'SGB' : 'Provident Fund';
    map[cat] = (map[cat] || 0) + val;
    totalVal += val;
  });

  if (totalVal <= 0) return '';

  const slices = Object.entries(map).map(([label, val], idx) => {
    const colors = ['#2563eb', '#059669', '#d97706', '#eab308', '#0284c7'];
    return {
      label,
      value: val,
      percent: (val / totalVal) * 100,
      color: colors[idx % colors.length],
    };
  });

  let cumulativeAngle = 0;
  const radius = 65;
  const cx = 100;
  const cy = 100;

  const sliceSvgs = slices.map((slice) => {
    const angle = (slice.percent / 100) * 360;
    const x1 = cx + radius * Math.cos((Math.PI * (cumulativeAngle - 90)) / 180);
    const y1 = cy + radius * Math.sin((Math.PI * (cumulativeAngle - 90)) / 180);
    cumulativeAngle += angle;
    const x2 = cx + radius * Math.cos((Math.PI * (cumulativeAngle - 90)) / 180);
    const y2 = cy + radius * Math.sin((Math.PI * (cumulativeAngle - 90)) / 180);
    const largeArc = angle > 180 ? 1 : 0;

    const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return `<path d="${pathData}" fill="${slice.color}" stroke="#ffffff" stroke-width="2" />`;
  }).join('');

  const legendHtml = slices.map((s) => `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-size: 10px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <div style="width: 10px; height: 10px; border-radius: 3px; background: ${s.color};"></div>
        <span style="font-weight: 600; color: #334155;">${s.label}</span>
      </div>
      <div class="mono" style="font-weight: 700; color: #0f172a;">
        ₹${formatCompactINR(s.value)} (${s.percent.toFixed(1)}%)
      </div>
    </div>
  `).join('');

  return `
  <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; gap: 20px;">
    <div style="flex: 1;">
      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 2px;">
        Asset Class Distribution
      </div>
      <div style="font-size: 10px; color: #64748b; margin-bottom: 12px;">
        Total Portfolio Valuation: ₹${formatINR(totalVal)}
      </div>
      ${legendHtml}
    </div>
    <div style="width: 200px; height: 200px; shrink: 0; display: flex; align-items: center; justify-content: center;">
      <svg width="200" height="200" viewBox="0 0 200 200">
        ${sliceSvgs}
        <circle cx="${cx}" cy="${cy}" r="38" fill="#ffffff" />
        <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="#0f172a" class="mono">ASSETS</text>
      </svg>
    </div>
  </div>`;
}

/**
 * Generates a clean, print-ready HTML Audit Report for an INDIVIDUAL Provident Fund (PF) Account
 * (Supports EPF, PPF, VPF, GPF, or Custom PF schemes)
 */
export function generatePfAccountReportHTML(holding: InvestmentHolding): string {
  const m = computePfMetrics(holding);
  const generatedDateStr = new Date().toLocaleDateString('en-IN', {
    dateStyle: 'full',
  });

  const totalContribs = m.totalEmployeeContributions + m.totalEmployerContributions + m.totalVoluntaryContributions + (holding.openingBalance || 0) - m.totalWithdrawals;
  const barChartSvg = buildProfitLossBarChartSVG([holding]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${m.accountName} - Individual PF Audit Report</title>
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
      font-family: Consolas, "Courier New", monospace;
    }
    .dossier {
      max-width: 820px;
      margin: 0 auto;
      padding: 16px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0284c7;
    }
    .title {
      font-size: 15px;
      font-weight: 700;
      margin-top: 2px;
      color: #0f172a;
    }
    .subtitle {
      font-size: 11px;
      color: #64748b;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .badge-pf {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 10px;
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }
    .card-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
    }
    .card-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 2px;
    }
    .card-value {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    .card-sub {
      font-size: 9px;
      color: #059669;
      font-weight: 600;
      margin-top: 2px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 16px;
    }
    th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9px;
      padding: 6px 8px;
      text-align: left;
      border-bottom: 1px solid #cbd5e1;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .positive {
      color: #059669;
      font-weight: 700;
    }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 9px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="dossier">
    <div class="header">
      <div>
        <div class="brand">FinSync</div>
        <div class="title">${m.accountName} (${m.pfTypeLabel})</div>
        <div class="subtitle">Ident / UAN: ${m.accountIdentifier} · Sovereign Rate: ${m.interestRate}% p.a.</div>
      </div>
      <div class="meta-box">
        <span class="badge-pf">${m.pfType} Individual Account</span>
        <div style="margin-top: 6px;">Generated: ${generatedDateStr}</div>
        <div>Statutory Retirement Asset Audit</div>
      </div>
    </div>

    <!-- Summary Cards Grid -->
    <div class="card-grid">
      <div class="card">
        <div class="card-label">Total Corpus Balance</div>
        <div class="card-value mono">₹${formatINR(m.totalCorpusBalance)}</div>
        <div class="card-sub">+₹${formatINR(m.totalInterestCredited)} interest</div>
      </div>

      <div class="card">
        <div class="card-label">Employee Share</div>
        <div class="card-value mono" style="color: #0369a1;">₹${formatINR(m.totalEmployeeContributions)}</div>
        <div style="font-size: 9px; color: #64748b;">Personal Contributions</div>
      </div>

      <div class="card">
        <div class="card-label">${m.pfType === 'EPF' ? 'Employer Share' : 'Voluntary Share'}</div>
        <div class="card-value mono" style="color: #2563eb;">₹${formatINR(m.pfType === 'EPF' ? m.totalEmployerContributions : m.totalVoluntaryContributions)}</div>
        <div style="font-size: 9px; color: #64748b;">${m.pfType === 'EPF' ? 'Matching Company Share' : 'VPF Additions'}</div>
      </div>

      <div class="card">
        <div class="card-label">Total Interest Credited</div>
        <div class="card-value mono positive">₹${formatINR(m.totalInterestCredited)}</div>
        <div style="font-size: 9px; color: #64748b;">Statutory Accruals</div>
      </div>
    </div>

    <!-- Embedded SVG Visual Bar Chart -->
    ${barChartSvg}

    <!-- Yearly Passbook Ledger Section -->
    <div class="section-title">Annual Financial Year Passbook Ledger</div>
    <table>
      <thead>
        <tr>
          <th>Financial Year</th>
          <th class="text-right">Opening Balance</th>
          <th class="text-right">Employee Contrib</th>
          <th class="text-right">Employer Contrib</th>
          <th class="text-right">Interest Credited</th>
          <th class="text-right">Withdrawals</th>
          <th class="text-right">Closing Balance</th>
        </tr>
      </thead>
      <tbody>
        ${m.financialYearLedger.length === 0
          ? `<tr><td colspan="7" class="text-center" style="color: #94a3b8; padding: 12px;">No financial year entries recorded yet</td></tr>`
          : m.financialYearLedger.map((fy) => `
            <tr>
              <td style="font-weight: 700;">${fy.financialYear}</td>
              <td class="text-right mono">₹${formatINR(fy.openingBalance)}</td>
              <td class="text-right mono">₹${formatINR(fy.employeeContributions)}</td>
              <td class="text-right mono">₹${formatINR(fy.employerContributions)}</td>
              <td class="text-right mono positive">₹${formatINR(fy.interestCredited)}</td>
              <td class="text-right mono" style="color: #dc2626;">₹${formatINR(fy.withdrawals)}</td>
              <td class="text-right mono" style="font-weight: 800;">₹${formatINR(fy.closingBalance)}</td>
            </tr>
          `).join('')}
      </tbody>
    </table>

    <!-- Detailed Transaction History Section -->
    <div class="section-title">Detailed Transaction History Ledger</div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type / Description</th>
          <th class="text-right">Employee (₹)</th>
          <th class="text-right">Employer (₹)</th>
          <th class="text-right">Total Amount (₹)</th>
          <th>Notes / Ref</th>
        </tr>
      </thead>
      <tbody>
        ${(holding.transactions || []).length === 0
          ? `<tr><td colspan="6" class="text-center" style="color: #94a3b8; padding: 12px;">No transactions recorded</td></tr>`
          : (holding.transactions || [])
              .slice()
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((t) => {
                const isInterest = t.type === 'interest' || t.type === 'coupon';
                const isWithdrawal = t.type === 'sell' || t.type === 'withdrawal';
                const amt = t.totalAmount || t.quantity || 0;
                return `
                  <tr>
                    <td class="mono">${formatDate(t.date)}</td>
                    <td style="font-weight: 600;">
                      ${isInterest ? 'Interest Credited' : isWithdrawal ? 'PF Withdrawal' : 'Contribution Deposit'}
                    </td>
                    <td class="text-right mono">${t.employeeAmount ? `₹${formatINR(t.employeeAmount)}` : '-'}</td>
                    <td class="text-right mono">${t.employerAmount ? `₹${formatINR(t.employerAmount)}` : '-'}</td>
                    <td class="text-right mono ${isInterest ? 'positive' : ''}">₹${formatINR(amt)}</td>
                    <td style="color: #64748b;">${t.notes || '-'}</td>
                  </tr>
                `;
              })
              .join('')}
      </tbody>
    </table>

    <div class="footer">
      <div>FinSync Retirement Asset Audit System</div>
      <div>Confidential · Page 1 of 1</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates an Audit Report HTML for an INDIVIDUAL Holding (Stock, Mutual Fund, Bond, or SGB)
 */
export function generateIndividualHoldingReportHTML(holding: InvestmentHolding): string {
  const generatedDateStr = new Date().toLocaleDateString('en-IN', {
    dateStyle: 'full',
  });

  let val = 0;
  let inv = 0;

  if (holding.assetType === 'pf') {
    return generatePfAccountReportHTML(holding);
  } else if (holding.assetType === 'bond') {
    const m = computeBondMetrics(holding);
    val = m.currentValuation + m.totalInterestReceived;
    inv = m.totalInvested;
  } else if (holding.assetType === 'sgb') {
    const m = computeSgbMetrics(holding);
    val = m.currentValuation;
    inv = m.totalInvested;
  } else {
    val = holding.quantity * (holding.currentPrice || holding.averageBuyPrice);
    inv = holding.quantity * holding.averageBuyPrice;
  }

  const pnl = val - inv;
  const pnlPct = inv > 0 ? (pnl / inv) * 100 : 0;
  const isProfit = pnl >= 0;

  const barChartSvg = buildProfitLossBarChartSVG([holding]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${holding.symbol} - Holding Audit Report</title>
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
      font-family: Consolas, "Courier New", monospace;
    }
    .dossier {
      max-width: 820px;
      margin: 0 auto;
      padding: 16px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0284c7;
    }
    .title {
      font-size: 15px;
      font-weight: 700;
      margin-top: 2px;
      color: #0f172a;
    }
    .subtitle {
      font-size: 11px;
      color: #64748b;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 10px;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .card-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
    }
    .card-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 2px;
    }
    .card-value {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 16px;
    }
    th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9px;
      padding: 6px 8px;
      text-align: left;
      border-bottom: 1px solid #cbd5e1;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .positive {
      color: #059669;
      font-weight: 700;
    }
    .negative {
      color: #dc2626;
      font-weight: 700;
    }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 9px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="dossier">
    <div class="header">
      <div>
        <div class="brand">FinSync</div>
        <div class="title">${holding.name} (${holding.symbol})</div>
        <div class="subtitle">${holding.assetType.toUpperCase().replace('_', ' ')} · Qty: ${holding.quantity}</div>
      </div>
      <div class="meta-box">
        <span class="badge">Asset Holding Dossier</span>
        <div style="margin-top: 6px;">Generated: ${generatedDateStr}</div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="card-grid">
      <div class="card">
        <div class="card-label">Current Valuation</div>
        <div class="card-value mono">₹${formatINR(val)}</div>
      </div>

      <div class="card">
        <div class="card-label">Total Invested Cost</div>
        <div class="card-value mono" style="color: #475569;">₹${formatINR(inv)}</div>
      </div>

      <div class="card">
        <div class="card-label">Unrealized P&L</div>
        <div class="card-value mono ${isProfit ? 'positive' : 'negative'}">
          ${isProfit ? '+' : ''}₹${formatINR(pnl)}
        </div>
      </div>

      <div class="card">
        <div class="card-label">Return %</div>
        <div class="card-value mono ${isProfit ? 'positive' : 'negative'}">
          ${isProfit ? '+' : ''}${pnlPct.toFixed(2)}%
        </div>
      </div>
    </div>

    <!-- Embedded SVG Visual Bar Chart -->
    ${barChartSvg}

    <!-- Transaction Ledger Section -->
    <div class="section-title">Trade & Activity Ledger</div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th class="text-right">Quantity / Units</th>
          <th class="text-right">Price per Unit (₹)</th>
          <th class="text-right">Total Amount (₹)</th>
          <th>Notes / Ref</th>
        </tr>
      </thead>
      <tbody>
        ${(holding.transactions || []).length === 0
          ? `<tr><td colspan="6" class="text-center" style="color: #94a3b8; padding: 12px;">No transactions recorded for this asset</td></tr>`
          : (holding.transactions || [])
              .slice()
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((t) => `
                <tr>
                  <td class="mono">${formatDate(t.date)}</td>
                  <td style="font-weight: 700; text-transform: uppercase;">${t.type}</td>
                  <td class="text-right mono">${t.quantity || 0}</td>
                  <td class="text-right mono">₹${formatINR(t.price || 0)}</td>
                  <td class="text-right mono" style="font-weight: 700;">₹${formatINR(t.totalAmount || 0)}</td>
                  <td style="color: #64748b;">${t.notes || '-'}</td>
                </tr>
              `)
              .join('')}
      </tbody>
    </table>

    <div class="footer">
      <div>FinSync Investment Audit System</div>
      <div>Confidential · Page 1 of 1</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates an Audit Report HTML for an ASSET CATEGORY (Stocks, Mutual Funds, SGB, Bonds, or PF Combined)
 */
export function generateAssetCategoryReportHTML(
  assetType: 'stock' | 'mutual_fund' | 'sgb' | 'bond' | 'pf' | 'all' | 'bonds_pf',
  holdings: InvestmentHolding[]
): string {
  const generatedDateStr = new Date().toLocaleDateString('en-IN', {
    dateStyle: 'full',
  });

  const categoryLabels: Record<string, string> = {
    stock: 'Stocks & Equities Portfolio',
    mutual_fund: 'Mutual Funds & SIP Portfolio',
    sgb: 'Sovereign Gold Bonds (SGB) Portfolio',
    bond: 'Fixed Income & Corporate Bonds',
    pf: 'Provident Funds (EPF / PPF / VPF / GPF)',
    bonds_pf: 'Bonds, SGBs & Provident Funds Portfolio',
    all: 'Complete Investment Portfolio',
  };

  const title = categoryLabels[assetType] || 'Investment Portfolio Audit Report';

  // Compute category totals
  let totalValuation = 0;
  let totalInvested = 0;

  holdings.forEach((h) => {
    if (h.assetType === 'pf') {
      const m = computePfMetrics(h);
      totalValuation += m.totalCorpusBalance;
      totalInvested += (m.totalEmployeeContributions + m.totalEmployerContributions + m.totalVoluntaryContributions + (h.openingBalance || 0) - m.totalWithdrawals);
    } else if (h.assetType === 'bond') {
      const m = computeBondMetrics(h);
      totalValuation += m.currentValuation + m.totalInterestReceived;
      totalInvested += m.totalInvested;
    } else if (h.assetType === 'sgb') {
      const m = computeSgbMetrics(h);
      totalValuation += m.currentValuation;
      totalInvested += m.totalInvested;
    } else {
      totalValuation += h.quantity * (h.currentPrice || h.averageBuyPrice);
      totalInvested += h.quantity * h.averageBuyPrice;
    }
  });

  const netGainLoss = totalValuation - totalInvested;
  const netGainLossPercent = totalInvested > 0 ? (netGainLoss / totalInvested) * 100 : 0;
  const isProfit = netGainLoss >= 0;

  const barChartSvg = buildProfitLossBarChartSVG(holdings);
  const donutChartSvg = buildAssetAllocationDonutSVG(holdings);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} - Audit Report</title>
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
      font-family: Consolas, "Courier New", monospace;
    }
    .dossier {
      max-width: 820px;
      margin: 0 auto;
      padding: 16px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0284c7;
    }
    .title {
      font-size: 15px;
      font-weight: 700;
      margin-top: 2px;
      color: #0f172a;
    }
    .subtitle {
      font-size: 11px;
      color: #64748b;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 10px;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .card-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
    }
    .card-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 2px;
    }
    .card-value {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 16px;
    }
    th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9px;
      padding: 6px 8px;
      text-align: left;
      border-bottom: 1px solid #cbd5e1;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .positive {
      color: #059669;
      font-weight: 700;
    }
    .negative {
      color: #dc2626;
      font-weight: 700;
    }
    .footer {
      main-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 9px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="dossier">
    <div class="header">
      <div>
        <div class="brand">FinSync</div>
        <div class="title">${title}</div>
        <div class="subtitle">${holdings.length} Active Holdings / Assets</div>
      </div>
      <div class="meta-box">
        <span class="badge">Asset Audit Dossier</span>
        <div style="margin-top: 6px;">Generated: ${generatedDateStr}</div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="card-grid">
      <div class="card">
        <div class="card-label">Current Valuation</div>
        <div class="card-value mono">₹${formatINR(totalValuation)}</div>
      </div>

      <div class="card">
        <div class="card-label">Total Invested Cost</div>
        <div class="card-value mono" style="color: #475569;">₹${formatINR(totalInvested)}</div>
      </div>

      <div class="card">
        <div class="card-label">Net Gain / Loss</div>
        <div class="card-value mono ${isProfit ? 'positive' : 'negative'}">
          ${isProfit ? '+' : ''}₹${formatINR(netGainLoss)}
        </div>
      </div>

      <div class="card">
        <div class="card-label">Return %</div>
        <div class="card-value mono ${isProfit ? 'positive' : 'negative'}">
          ${isProfit ? '+' : ''}${netGainLossPercent.toFixed(2)}%
        </div>
      </div>
    </div>

    <!-- Embedded SVG Visual Growth Graph & Donut Chart -->
    ${barChartSvg}
    ${holdings.length > 1 ? donutChartSvg : ''}

    <!-- Holdings Summary Table -->
    <div class="section-title">Holdings Breakdown</div>
    <table>
      <thead>
        <tr>
          <th>Asset / Symbol</th>
          <th class="text-right">Units / Qty</th>
          <th class="text-right">Avg Cost (₹)</th>
          <th class="text-right">CMP / Value (₹)</th>
          <th class="text-right">Invested Cost (₹)</th>
          <th class="text-right">Valuation (₹)</th>
          <th class="text-right">P&L (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${holdings.length === 0
          ? `<tr><td colspan="7" class="text-center" style="color: #94a3b8; padding: 12px;">No holdings recorded in this asset category</td></tr>`
          : holdings.map((h) => {
              let hVal = 0;
              let hInv = 0;
              let hPrice = h.currentPrice || h.averageBuyPrice;

              if (h.assetType === 'pf') {
                const m = computePfMetrics(h);
                hVal = m.totalCorpusBalance;
                hInv = m.totalEmployeeContributions + m.totalEmployerContributions + m.totalVoluntaryContributions + (h.openingBalance || 0) - m.totalWithdrawals;
                hPrice = 1;
              } else if (h.assetType === 'bond') {
                const m = computeBondMetrics(h);
                hVal = m.currentValuation + m.totalInterestReceived;
                hInv = m.totalInvested;
                hPrice = m.marketPricePerUnit;
              } else if (h.assetType === 'sgb') {
                const m = computeSgbMetrics(h);
                hVal = m.currentValuation;
                hInv = m.totalInvested;
                hPrice = m.marketPricePerUnit;
              } else {
                hVal = h.quantity * hPrice;
                hInv = h.quantity * h.averageBuyPrice;
              }

              const pnl = hVal - hInv;
              const hIsProfit = pnl >= 0;

              return `
                <tr>
                  <td>
                    <strong style="color: #0f172a;">${h.symbol}</strong>
                    <div style="font-size: 9px; color: #64748b;">${h.name}</div>
                  </td>
                  <td class="text-right mono">${h.assetType === 'pf' ? formatINR(h.quantity) : h.quantity}</td>
                  <td class="text-right mono">${h.assetType === 'pf' ? '1.00' : formatINR(h.averageBuyPrice)}</td>
                  <td class="text-right mono">${formatINR(hPrice)}</td>
                  <td class="text-right mono">₹${formatINR(hInv)}</td>
                  <td class="text-right mono" style="font-weight: 700;">₹${formatINR(hVal)}</td>
                  <td class="text-right mono ${hIsProfit ? 'positive' : 'negative'}">
                    ${hIsProfit ? '+' : ''}₹${formatINR(pnl)}
                  </td>
                </tr>
              `;
            }).join('')}
      </tbody>
    </table>

    <div class="footer">
      <div>FinSync Investment Audit System</div>
      <div>Confidential · Page 1 of 1</div>
    </div>
  </div>
</body>
</html>`;
}
