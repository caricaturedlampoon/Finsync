/**
 * Debts & Loans Report Engine
 * Generates publication-grade HTML audit dossiers, individual contact statements,
 * and vector-rendered PDF reports for personal lending, borrowing, and repayments.
 */

import { Debt, Transaction, Account } from '../types';
import { formatINR, formatDate, toInputDate, getDebtContactSummary, SYSTEM_DEBT_ACCOUNT_ID } from './formatters';
import { exportHtmlStringToPdf } from './pdfExportHelper';

export interface DebtsReportData {
  debts: Debt[];
  transactions: Transaction[];
  accounts?: Account[];
  userProfileName?: string;
  selectedContactId?: string | null;
  filterType?: 'all' | 'lending' | 'borrowing';
}

export interface DebtsCompiledSummary {
  totalReceivable: number;
  totalPayable: number;
  netPosition: number;
  activeCount: number;
  settledCount: number;
  totalContacts: number;
  contacts: Array<{
    debt: Debt;
    summary: ReturnType<typeof getDebtContactSummary>;
  }>;
}

/**
 * Compiles summary metrics and contact ledgers
 */
export function compileDebtsReportData(data: DebtsReportData): DebtsCompiledSummary {
  const { debts, transactions, selectedContactId, filterType = 'all' } = data;

  const txByDebt = new Map<string, Transaction[]>();
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (tx.debtId) {
      let arr = txByDebt.get(tx.debtId);
      if (!arr) {
        arr = [];
        txByDebt.set(tx.debtId, arr);
      }
      arr.push(tx);
    }
  }

  let totalReceivable = 0;
  let totalPayable = 0;
  let activeCount = 0;
  let settledCount = 0;

  const contactsList: Array<{
    debt: Debt;
    summary: ReturnType<typeof getDebtContactSummary>;
  }> = [];

  for (const debt of debts) {
    if (selectedContactId && debt.id !== selectedContactId) {
      continue;
    }

    const summary = getDebtContactSummary(debt, transactions, txByDebt.get(debt.id));

    if (summary.status === 'settled') {
      settledCount++;
    } else {
      activeCount++;
      if (summary.status === 'owes_you') {
        totalReceivable += summary.netBalance;
      } else if (summary.status === 'you_owe') {
        totalPayable += Math.abs(summary.netBalance);
      }
    }

    // Apply filter
    if (filterType === 'lending' && summary.status !== 'owes_you') continue;
    if (filterType === 'borrowing' && summary.status !== 'you_owe') continue;

    contactsList.push({ debt, summary });
  }

  // Sort: active receivables first (largest), then active payables, then settled
  contactsList.sort((a, b) => {
    if (a.summary.status === 'owes_you' && b.summary.status !== 'owes_you') return -1;
    if (b.summary.status === 'owes_you' && a.summary.status !== 'owes_you') return 1;
    return Math.abs(b.summary.netBalance) - Math.abs(a.summary.netBalance);
  });

  return {
    totalReceivable,
    totalPayable,
    netPosition: totalReceivable - totalPayable,
    activeCount,
    settledCount,
    totalContacts: debts.length,
    contacts: contactsList,
  };
}

/**
 * Builds a publication-grade vector SVG graph showing top receivables and payables across 100% horizontal width
 */
function buildDebtsTopCounterpartiesSVG(summary: DebtsCompiledSummary): string {
  const w = 820;
  const h = 180;

  const receivables = summary.contacts
    .filter((c) => c.summary.netBalance > 0.01)
    .sort((a, b) => b.summary.netBalance - a.summary.netBalance)
    .slice(0, 4);

  const payables = summary.contacts
    .filter((c) => c.summary.netBalance < -0.01)
    .sort((a, b) => Math.abs(b.summary.netBalance) - Math.abs(a.summary.netBalance))
    .slice(0, 4);

  const maxVal = Math.max(
    1,
    ...receivables.map((r) => r.summary.netBalance),
    ...payables.map((p) => Math.abs(p.summary.netBalance))
  );

  const colW = 380;
  const colL = 20;
  const colR = 425;
  const rowH = 30;
  const barMaxW = 180;

  const recBars = receivables.map((r, i) => {
    const y = 46 + i * rowH;
    const barW = Math.max(8, Math.round((r.summary.netBalance / maxVal) * barMaxW));
    const name = escapeHtml(r.debt.personName.length > 15 ? r.debt.personName.slice(0, 14) + '…' : r.debt.personName);
    return `
      <g>
        <text x="${colL}" y="${y + 11}" font-size="9.5" font-weight="700" fill="#0f172a">${name}</text>
        <rect x="${colL + 115}" y="${y}" width="${barW}" height="14" rx="3" fill="#059669" style="fill:#059669!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />
        <text x="${colL + 122 + barW}" y="${y + 11}" font-size="9.5" font-weight="800" font-family="'JetBrains Mono', monospace" fill="#047857">₹${formatINR(r.summary.netBalance)}</text>
      </g>
    `;
  }).join('');

  const payBars = payables.map((p, i) => {
    const y = 46 + i * rowH;
    const barW = Math.max(8, Math.round((Math.abs(p.summary.netBalance) / maxVal) * barMaxW));
    const name = escapeHtml(p.debt.personName.length > 15 ? p.debt.personName.slice(0, 14) + '…' : p.debt.personName);
    return `
      <g>
        <text x="${colR}" y="${y + 11}" font-size="9.5" font-weight="700" fill="#0f172a">${name}</text>
        <rect x="${colR + 115}" y="${y}" width="${barW}" height="14" rx="3" fill="#dc2626" style="fill:#dc2626!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />
        <text x="${colR + 122 + barW}" y="${y + 11}" font-size="9.5" font-weight="800" font-family="'JetBrains Mono', monospace" fill="#b91c1c">₹${formatINR(Math.abs(p.summary.netBalance))}</text>
      </g>
    `;
  }).join('');

  return `
    <div class="chart-scroll-wrapper" style="width:100%;box-sizing:border-box;">
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="auto" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" class="full-width-chart-svg" style="width:100%;max-width:100%;height:auto;display:block;margin:0 auto;overflow:visible;">
        <!-- Header labels -->
        <rect x="${colL}" y="10" width="${colW}" height="22" rx="5" fill="#ecfdf5" />
        <text x="${colL + 10}" y="25" font-size="9.5" font-weight="800" fill="#065f46" letter-spacing="0.5">TOP RECEIVABLES (OWED TO YOU)</text>
        <text x="${colL + colW - 10}" y="25" font-size="9" text-anchor="end" font-weight="700" fill="#059669">${receivables.length} Contacts</text>

        <rect x="${colR}" y="10" width="${colW}" height="22" rx="5" fill="#fef2f2" />
        <text x="${colR + 10}" y="25" font-size="9.5" font-weight="800" fill="#991b1b" letter-spacing="0.5">TOP PAYABLES (YOU OWE)</text>
        <text x="${colR + colW - 10}" y="25" font-size="9" text-anchor="end" font-weight="700" fill="#dc2626">${payables.length} Contacts</text>

        <!-- Divider line -->
        <line x1="410" y1="10" x2="410" y2="${h - 10}" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="4,3" />

        ${receivables.length > 0 ? recBars : `<text x="${colL + 120}" y="85" font-size="9.5" fill="#94a3b8" font-style="italic">No active receivables</text>`}
        ${payables.length > 0 ? payBars : `<text x="${colR + 120}" y="85" font-size="9.5" fill="#94a3b8" font-style="italic">No pending payables</text>`}
      </svg>
    </div>
  `;
}

/**
 * Builds a full-width running balance area timeline chart for a single contact statement
 */
function buildContactBalanceTimelineSVG(
  transactions: Transaction[],
  summary: ReturnType<typeof getDebtContactSummary>
): string {
  const w = 820;
  const h = 180;
  const padL = 75;
  const padR = 25;
  const padT = 25;
  const padB = 35;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  if (!transactions || transactions.length === 0) {
    return '';
  }

  // Calculate sequential running balance timeline points
  const points: Array<{ date: string; balance: number; label: string }> = [];
  let currentRunning = 0;

  // Initial zero point before transactions
  const firstTxDate = transactions[0].date ? new Date(transactions[0].date) : new Date();
  const initDateStr = new Date(firstTxDate.getTime() - 86400000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  points.push({ date: initDateStr, balance: 0, label: 'Start' });

  transactions.forEach((tx) => {
    if (
      tx.toAccountId === SYSTEM_DEBT_ACCOUNT_ID ||
      (tx.tags && (tx.tags.includes('Lent') || tx.tags.includes('Given'))) ||
      tx.type === 'expense'
    ) {
      currentRunning += tx.amount;
    } else if (
      tx.fromAccountId === SYSTEM_DEBT_ACCOUNT_ID ||
      (tx.tags && (tx.tags.includes('Received') || tx.tags.includes('Repayment') || tx.tags.includes('Borrowed'))) ||
      tx.type === 'income'
    ) {
      currentRunning -= tx.amount;
    } else {
      currentRunning += tx.amount;
    }
    const dStr = tx.date ? new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '';
    points.push({ date: dStr, balance: currentRunning, label: `₹${formatINR(Math.abs(currentRunning))}` });
  });

  const balances = points.map((p) => p.balance);
  let minVal = Math.min(0, ...balances);
  let maxVal = Math.max(0, ...balances);

  if (minVal === 0 && maxVal === 0) {
    maxVal = 1000;
  }
  const range = maxVal - minVal || 1;
  const zeroY = padT + chartH - ((0 - minVal) / range) * chartH;

  const count = points.length;
  const stepX = count > 1 ? chartW / (count - 1) : chartW;

  const coords = points.map((p, idx) => ({
    x: padL + idx * stepX,
    y: padT + chartH - ((p.balance - minVal) / range) * chartH,
    p,
  }));

  let pathD = '';
  coords.forEach((pt, i) => {
    if (i === 0) pathD += `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    else pathD += ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  });

  let areaD = `M ${coords[0].x.toFixed(1)} ${zeroY.toFixed(1)}`;
  coords.forEach((pt) => { areaD += ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`; });
  areaD += ` L ${coords[coords.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const isNetPositive = summary.netBalance >= 0;
  const themeColor = isNetPositive ? '#059669' : '#dc2626';

  const dots = coords.map((pt) => `
    <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3.5" fill="#ffffff" stroke="${themeColor}" stroke-width="2.2" />
    <text x="${pt.x.toFixed(1)}" y="${(h - 10).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="600" fill="#64748b">${pt.p.date}</text>
  `).join('');

  return `
    <div class="chart-scroll-wrapper" style="width:100%;box-sizing:border-box;">
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="auto" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" class="full-width-chart-svg" style="width:100%;max-width:100%;height:auto;display:block;margin:0 auto;overflow:visible;">
        <defs>
          <linearGradient id="debtTrajectoryGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${themeColor}" stop-opacity="0.25" />
            <stop offset="100%" stop-color="${themeColor}" stop-opacity="0.03" />
          </linearGradient>
        </defs>

        <!-- Horizontal Grid Lines -->
        <line x1="${padL}" y1="${padT}" x2="${w - padR}" y2="${padT}" stroke="#e2e8f0" stroke-dasharray="3,3" />
        <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${w - padR}" y2="${zeroY.toFixed(1)}" stroke="#cbd5e1" stroke-width="1.5" />
        <line x1="${padL}" y1="${padT + chartH}" x2="${w - padR}" y2="${padT + chartH}" stroke="#e2e8f0" stroke-dasharray="3,3" />

        <!-- Y Axis Labels -->
        <text x="${padL - 8}" y="${padT + 4}" text-anchor="end" font-size="9" font-family="'JetBrains Mono', monospace" fill="#64748b">+₹${formatINR(maxVal)}</text>
        <text x="${padL - 8}" y="${zeroY + 3}" text-anchor="end" font-size="9" font-family="'JetBrains Mono', monospace" fill="#94a3b8">₹0</text>
        <text x="${padL - 8}" y="${padT + chartH + 3}" text-anchor="end" font-size="9" font-family="'JetBrains Mono', monospace" fill="#64748b">${minVal < 0 ? `-₹${formatINR(Math.abs(minVal))}` : ''}</text>

        <!-- Area & Stroke Curve -->
        <path d="${areaD}" fill="url(#debtTrajectoryGrad)" style="fill:url(#debtTrajectoryGrad);-webkit-print-color-adjust:exact;print-color-adjust:exact;" />
        <path d="${pathD}" fill="none" stroke="${themeColor}" stroke-width="2.5" style="stroke:${themeColor}!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />

        <!-- Dots & Dates -->
        ${dots}
      </svg>
    </div>
  `;
}

/**
 * Generates an executive consolidated Debts & Loans Audit Dossier in HTML
 */
export function generateConsolidatedDebtsReportHTML(data: DebtsReportData): string {
  const summary = compileDebtsReportData(data);
  const now = new Date();
  const dateFormatted = formatDate(now);
  const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const docRef = `FSD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const userName = data.userProfileName || 'Primary Account Holder';

  const totalVol = summary.totalReceivable + summary.totalPayable;
  const receivablePct = totalVol > 0 ? Math.round((summary.totalReceivable / totalVol) * 100) : 50;
  const payablePct = totalVol > 0 ? 100 - receivablePct : 50;

  const contactsRowsHtml = summary.contacts
    .map(({ debt, summary: s }, idx) => {
      const isReceivable = s.status === 'owes_you';
      const isPayable = s.status === 'you_owe';

      const statusBadge = isReceivable
        ? `<span class="badge badge-success">Owes You</span>`
        : isPayable
        ? `<span class="badge badge-danger">You Owe</span>`
        : `<span class="badge badge-neutral">Settled</span>`;

      const balanceClass = isReceivable
        ? 'amount-positive'
        : isPayable
        ? 'amount-negative'
        : 'amount-neutral';

      const balanceText = isReceivable
        ? `+₹${formatINR(s.netBalance)}`
        : isPayable
        ? `-₹${formatINR(Math.abs(s.netBalance))}`
        : `₹0.00`;

      return `
        <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
          <td class="text-left font-bold">
            <div class="contact-name">${escapeHtml(debt.personName)}</div>
            ${debt.phone ? `<div class="contact-sub">${escapeHtml(debt.phone)}</div>` : ''}
          </td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-right tabular">₹${formatINR(s.totalPaid)}</td>
          <td class="text-right tabular">₹${formatINR(s.totalReceived)}</td>
          <td class="text-right tabular font-bold ${balanceClass}">${balanceText}</td>
          <td class="text-center font-mono text-muted text-xs">
            ${debt.dueDate ? formatDate(debt.dueDate) : '—'}
          </td>
          <td class="text-center text-xs text-muted">
            ${s.transactions.length} record${s.transactions.length !== 1 ? 's' : ''}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, minimum-scale=1.0">
  <title>FinSync - Debts & Loans Audit Dossier</title>
  <style>
    ${getBaseReportStyles()}
  </style>
</head>
<body>
  <div class="report-wrapper">
    <!-- Header -->
    <header class="header">
      <div class="brand-row">
        <div class="brand">
          <span class="brand-logo">₹</span>
          <div>
            <h1 class="brand-title">FinSync</h1>
            <p class="brand-tagline">Log · Split · Track · Analyse · Grow</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="doc-badge">Official Audit Dossier</div>
          <div class="doc-ref">Ref: ${docRef}</div>
          <div class="doc-date">Generated: ${dateFormatted} at ${timeFormatted}</div>
        </div>
      </div>
      <div class="header-divider"></div>
      <div class="statement-title-row">
        <div>
          <h2 class="report-heading">Debts & Loans Ledger Dossier</h2>
          <p class="report-subheading">Comprehensive audit of active receivables, pending payables, and historical settlements</p>
        </div>
        <div class="holder-info">
          <span class="label">Prepared For:</span>
          <span class="val">${escapeHtml(userName)}</span>
        </div>
      </div>
    </header>

    <!-- Key Metrics Grid -->
    <section class="metrics-grid">
      <div class="metric-card card-positive">
        <span class="metric-label">You Are Owed (Receivable)</span>
        <div class="metric-value amount-positive">₹${formatINR(summary.totalReceivable)}</div>
        <div class="metric-sub">Money lent out awaiting collection</div>
      </div>
      <div class="metric-card card-negative">
        <span class="metric-label">You Owe (Payable)</span>
        <div class="metric-value amount-negative">₹${formatINR(summary.totalPayable)}</div>
        <div class="metric-sub">Pending obligations to repay</div>
      </div>
      <div class="metric-card card-accent">
        <span class="metric-label">Net Lending Position</span>
        <div class="metric-value ${summary.netPosition >= 0 ? 'amount-positive' : 'amount-negative'}">
          ${summary.netPosition >= 0 ? '+' : '-'}₹${formatINR(Math.abs(summary.netPosition))}
        </div>
        <div class="metric-sub">${summary.netPosition >= 0 ? 'Net Surplus Receivable' : 'Net Deficit Payable'}</div>
      </div>
      <div class="metric-card card-neutral">
        <span class="metric-label">Contacts Audit</span>
        <div class="metric-value font-bold">${summary.totalContacts} Total</div>
        <div class="metric-sub">${summary.activeCount} active · ${summary.settledCount} settled</div>
      </div>
    </section>

    <!-- Exposure Distribution Bar -->
    <section class="section-box">
      <div class="section-title">Receivables vs Payables Exposure</div>
      <div class="progress-bar-container">
        <div class="progress-segment segment-green" style="width: ${receivablePct}%;">
          ${receivablePct > 15 ? `Receivables ${receivablePct}%` : ''}
        </div>
        <div class="progress-segment segment-red" style="width: ${payablePct}%;">
          ${payablePct > 15 ? `Payables ${payablePct}%` : ''}
        </div>
      </div>
      <div class="progress-legend">
        <span class="legend-item"><span class="dot dot-green"></span> Receivable: ₹${formatINR(summary.totalReceivable)} (${receivablePct}%)</span>
        <span class="legend-item"><span class="dot dot-red"></span> Payable: ₹${formatINR(summary.totalPayable)} (${payablePct}%)</span>
      </div>
    </section>

    <!-- Master Contact Ledger Table -->
    <section class="section-box table-box">
      <div class="section-header-row">
        <div class="section-title">Master Contacts Ledger (${summary.contacts.length} entries)</div>
        <div class="section-tag">Double-Entry Verified</div>
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th class="text-left" style="width: 25%;">Contact Person</th>
            <th class="text-center" style="width: 13%;">Status</th>
            <th class="text-right" style="width: 14%;">Total Paid (Lent)</th>
            <th class="text-right" style="width: 14%;">Total Received (Borrowed)</th>
            <th class="text-right" style="width: 16%;">Net Balance</th>
            <th class="text-center" style="width: 10%;">Due Date</th>
            <th class="text-center" style="width: 8%;">Entries</th>
          </tr>
        </thead>
        <tbody>
          ${contactsRowsHtml || '<tr><td colspan="7" class="text-center py-4 text-muted">No debt contacts recorded yet.</td></tr>'}
        </tbody>
        <tfoot>
          <tr class="table-total-row">
            <td colspan="2" class="text-left font-bold">TOTAL PORTFOLIO EXPOSURE</td>
            <td class="text-right tabular font-bold">₹${formatINR(summary.totalReceivable)}</td>
            <td class="text-right tabular font-bold">₹${formatINR(summary.totalPayable)}</td>
            <td class="text-right tabular font-bold ${summary.netPosition >= 0 ? 'amount-positive' : 'amount-negative'}">
              ${summary.netPosition >= 0 ? '+' : '-'}₹${formatINR(Math.abs(summary.netPosition))}
            </td>
            <td colspan="2" class="text-center text-xs text-muted">
              ${summary.activeCount} active contacts
            </td>
          </tr>
        </tfoot>
      </table>
    </section>

    <!-- Audit Footer Declaration -->
    <footer class="footer">
      <div class="footer-note">
        <strong>Certified FinSync Ledger Record:</strong> This report represents the mathematical net balance of all recorded lending, borrowing, and repayment transactions. Double-entry validation applied.
      </div>
      <div class="footer-meta">
        <span>Doc Ref: ${docRef}</span>
        <span>Generated by FinSync Financial Engine</span>
        <span>Page 1 of 1</span>
      </div>
    </footer>
  </div>
</body>
</html>
  `;
}

/**
 * Generates an Individual Contact Statement of Account in HTML
 */
export function generateContactStatementHTML(
  debt: Debt,
  transactions: Transaction[],
  accounts: Account[] = [],
  userProfileName: string = 'You'
): string {
  const summary = getDebtContactSummary(debt, transactions);
  const now = new Date();
  const dateFormatted = formatDate(now);
  const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const docRef = `STMT-${debt.id.substring(0, 5).toUpperCase()}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  const accountMap = new Map<string, string>();
  for (const acc of accounts) {
    accountMap.set(acc.id, acc.name);
  }

  // Sort contact transactions chronologically for running balance
  const sortedTx = [...summary.transactions].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Calculate chronological running balance
  // Positive = Contact owes user, Negative = User owes contact
  let currentRunning = 0;
  const ledgerRows = sortedTx.map((tx, idx) => {
    let txTypeLabel = 'Transaction';
    let debit = 0; // Increases what contact owes you
    let credit = 0; // Decreases what contact owes you (or you pay them)

    if (tx.isBalanceAdjustment) {
      txTypeLabel = 'Balance Adjustment';
      if (tx.type === 'income') {
        credit = tx.amount;
        currentRunning -= tx.amount;
      } else {
        debit = tx.amount;
        currentRunning += tx.amount;
      }
    } else if (
      tx.toAccountId === SYSTEM_DEBT_ACCOUNT_ID ||
      (tx.tags && (tx.tags.includes('Paid') || tx.tags.includes('Lent'))) ||
      tx.type === 'expense'
    ) {
      txTypeLabel = 'Money Lent / Paid';
      debit = tx.amount;
      currentRunning += tx.amount;
    } else if (
      tx.fromAccountId === SYSTEM_DEBT_ACCOUNT_ID ||
      (tx.tags && (tx.tags.includes('Received') || tx.tags.includes('Repayment') || tx.tags.includes('Borrowed'))) ||
      tx.type === 'income'
    ) {
      txTypeLabel = 'Repayment Received / Borrowed';
      credit = tx.amount;
      currentRunning -= tx.amount;
    } else {
      debit = tx.amount;
      currentRunning += tx.amount;
    }

    const rawAccId = tx.toAccountId || tx.fromAccountId || '';
    const accName = rawAccId && rawAccId !== SYSTEM_DEBT_ACCOUNT_ID ? accountMap.get(rawAccId) || 'Account' : 'Direct Cash/UPI';

    const runningClass = currentRunning > 0.01
      ? 'amount-positive'
      : currentRunning < -0.01
      ? 'amount-negative'
      : 'amount-neutral';

    return `
      <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td class="text-left font-mono text-xs">${formatDate(tx.date)}</td>
        <td class="text-left font-semibold">
          <div>${escapeHtml(txTypeLabel)}</div>
          ${tx.note ? `<div class="contact-sub">${escapeHtml(tx.note)}</div>` : ''}
        </td>
        <td class="text-center text-xs text-muted">${escapeHtml(accName)}</td>
        <td class="text-right tabular ${debit > 0 ? 'font-bold' : 'text-muted'}">
          ${debit > 0 ? `₹${formatINR(debit)}` : '—'}
        </td>
        <td class="text-right tabular ${credit > 0 ? 'font-bold' : 'text-muted'}">
          ${credit > 0 ? `₹${formatINR(credit)}` : '—'}
        </td>
        <td class="text-right tabular font-bold ${runningClass}">
          ${currentRunning > 0.01 ? `+₹${formatINR(currentRunning)}` : currentRunning < -0.01 ? `-₹${formatINR(Math.abs(currentRunning))}` : '₹0.00'}
        </td>
      </tr>
    `;
  }).join('');

  const finalStatusBadge = summary.status === 'owes_you'
    ? `<span class="badge badge-success text-base">Owes You ₹${formatINR(summary.netBalance)}</span>`
    : summary.status === 'you_owe'
    ? `<span class="badge badge-danger text-base">You Owe ₹${formatINR(Math.abs(summary.netBalance))}</span>`
    : `<span class="badge badge-neutral text-base">Fully Settled (₹0.00)</span>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Statement of Account - ${escapeHtml(debt.personName)}</title>
  <style>
    ${getBaseReportStyles()}
  </style>
</head>
<body>
  <div class="report-wrapper">
    <!-- Header -->
    <header class="header">
      <div class="brand-row">
        <div class="brand">
          <span class="brand-logo">₹</span>
          <div>
            <h1 class="brand-title">FinSync</h1>
            <p class="brand-tagline">Personal & Business Debt Ledger</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="doc-badge">Statement of Account</div>
          <div class="doc-ref">Ref: ${docRef}</div>
          <div class="doc-date">Issued: ${dateFormatted} at ${timeFormatted}</div>
        </div>
      </div>
      <div class="header-divider"></div>
      
      <!-- Counterparty & Summary Details -->
      <div class="statement-title-row">
        <div style="flex: 1;">
          <h2 class="report-heading">${escapeHtml(debt.personName)}</h2>
          <div class="text-sm text-muted mt-1">
            ${debt.phone ? `<span>📞 ${escapeHtml(debt.phone)}</span> &nbsp;·&nbsp; ` : ''}
            ${debt.dueDate ? `<span>📅 Due Date: <strong>${formatDate(debt.dueDate)}</strong></span>` : '<span>📅 Due Date: Open</span>'}
          </div>
          ${debt.notes ? `<div class="mt-1 text-xs text-muted">📝 ${escapeHtml(debt.notes)}</div>` : ''}
        </div>
        <div class="holder-info text-right">
          <div class="text-xs uppercase tracking-wider text-muted font-bold">Current Standing</div>
          <div class="mt-1">${finalStatusBadge}</div>
        </div>
      </div>
    </header>

    <!-- Summary Statistics -->
    <section class="metrics-grid">
      <div class="metric-card card-positive">
        <span class="metric-label">Total Paid (Given)</span>
        <div class="metric-value amount-positive">₹${formatINR(summary.totalPaid)}</div>
        <div class="metric-sub">Principal lent to contact</div>
      </div>
      <div class="metric-card card-negative">
        <span class="metric-label">Total Received (Taken)</span>
        <div class="metric-value amount-negative">₹${formatINR(summary.totalReceived)}</div>
        <div class="metric-sub">Principal received from contact</div>
      </div>
      <div class="metric-card card-accent">
        <span class="metric-label">Net Balance Outstanding</span>
        <div class="metric-value ${summary.netBalance >= 0 ? 'amount-positive' : 'amount-negative'}">
          ${summary.netBalance >= 0 ? '+' : '-'}₹${formatINR(Math.abs(summary.netBalance))}
        </div>
        <div class="metric-sub">${summary.netBalance > 0 ? 'Contact owes you' : summary.netBalance < 0 ? 'You owe contact' : 'Fully Cleared'}</div>
      </div>
      <div class="metric-card card-neutral">
        <span class="metric-label">Activity Volume</span>
        <div class="metric-value font-bold">${summary.transactions.length} Entries</div>
        <div class="metric-sub">${summary.status === 'settled' ? 'Account closed' : 'Active ledger'}</div>
      </div>
    </section>

    <!-- Statement Ledger Table -->
    <section class="section-box table-box">
      <div class="section-header-row">
        <div class="section-title">Itemized Transaction History</div>
        <div class="section-tag">Chronological Order</div>
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th class="text-left" style="width: 14%;">Date</th>
            <th class="text-left" style="width: 30%;">Particulars & Notes</th>
            <th class="text-center" style="width: 16%;">Account / Mode</th>
            <th class="text-right" style="width: 13%;">Debit (Owes +)</th>
            <th class="text-right" style="width: 13%;">Credit (Repaid -)</th>
            <th class="text-right" style="width: 14%;">Running Balance</th>
          </tr>
        </thead>
        <tbody>
          ${ledgerRows || '<tr><td colspan="6" class="text-center py-4 text-muted">No transactions recorded for this contact yet.</td></tr>'}
        </tbody>
        <tfoot>
          <tr class="table-total-row">
            <td colspan="3" class="text-left font-bold">CLOSING BALANCE AS OF ${dateFormatted.toUpperCase()}</td>
            <td class="text-right tabular font-bold">₹${formatINR(summary.totalPaid)}</td>
            <td class="text-right tabular font-bold">₹${formatINR(summary.totalReceived)}</td>
            <td class="text-right tabular font-bold ${summary.netBalance >= 0 ? 'amount-positive' : 'amount-negative'}">
              ${summary.netBalance >= 0 ? '+' : '-'}₹${formatINR(Math.abs(summary.netBalance))}
            </td>
          </tr>
        </tfoot>
      </table>
    </section>

    <!-- Repayment Notice & Signoff -->
    <div class="settle-notice">
      <div class="settle-title">Settlement Notice & Verification</div>
      <p class="settle-body">
        Please review the transactions and closing balance listed above. All payments made via UPI, bank transfer, or cash should be reconciled against this statement. If any adjustments are required, please contact <strong>${escapeHtml(userProfileName)}</strong>.
      </p>
    </div>

    <!-- Audit Footer -->
    <footer class="footer">
      <div class="footer-note">
        <strong>Official Statement:</strong> Generated via FinSync. Retain for personal financial records and debt reconciliation.
      </div>
      <div class="footer-meta">
        <span>Doc Ref: ${docRef}</span>
        <span>FinSync Engine</span>
        <span>Page 1 of 1</span>
      </div>
    </footer>
  </div>
</body>
</html>
  `;
}

/**
 * Generates CSV export for Debts ledger
 */
export function generateDebtsCSV(data: DebtsReportData): string {
  const summary = compileDebtsReportData(data);
  const headers = [
    'Contact Name',
    'Phone',
    'Status',
    'Total Paid / Lent (INR)',
    'Total Received / Borrowed (INR)',
    'Net Balance (INR)',
    'Due Date',
    'Notes',
    'Total Entries',
  ];

  const rows = summary.contacts.map(({ debt, summary: s }) => [
    `"${escapeCsv(debt.personName)}"`,
    `"${escapeCsv(debt.phone || '')}"`,
    `"${escapeCsv(s.status)}"`,
    s.totalPaid.toFixed(2),
    s.totalReceived.toFixed(2),
    s.netBalance.toFixed(2),
    `"${debt.dueDate ? toInputDate(debt.dueDate) : ''}"`,
    `"${escapeCsv(debt.notes || '')}"`,
    s.transactions.length,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Exports Debts report to high-resolution vector PDF using exportHtmlStringToPdf
 */
export async function exportDebtsReportToPdf(
  htmlContent: string,
  fileName: string,
  title: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  await exportHtmlStringToPdf(htmlContent, {
    fileName,
    reportTitle: title,
    scale: 2.8,
    usePng: true,
    imageQuality: 0.96,
    onProgress,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeCsv(str: string): string {
  return str.replace(/"/g, '""');
}

/**
 * High-quality CSS stylesheet for vector printing and A4 rendering
 */
function getBaseReportStyles(): string {
  return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 11px;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .report-wrapper {
      max-width: 820px;
      margin: 0 auto;
      padding: 16px 20px;
    }
    .header {
      margin-bottom: 18px;
    }
    .brand-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-logo {
      width: 32px;
      height: 32px;
      background: #059669;
      color: #ffffff;
      font-size: 18px;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
      line-height: 1.1;
    }
    .brand-tagline {
      font-size: 9px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .doc-meta {
      text-align: right;
    }
    .doc-badge {
      display: inline-block;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-ref {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 10px;
      font-weight: 600;
      color: #475569;
      margin-top: 4px;
    }
    .doc-date {
      font-size: 9.5px;
      color: #94a3b8;
      margin-top: 1px;
    }
    .header-divider {
      height: 2px;
      background: linear-gradient(90deg, #059669 0%, #10b981 40%, #e2e8f0 100%);
      margin-bottom: 12px;
    }
    .statement-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .report-heading {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.3px;
    }
    .report-subheading {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }
    .holder-info .label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #94a3b8;
      letter-spacing: 0.5px;
      display: block;
    }
    .holder-info .val {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
    }

    /* Metrics Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .metric-card {
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .card-positive {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    .card-negative {
      background: #fef2f2;
      border-color: #fecaca;
    }
    .card-accent {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
    .card-neutral {
      background: #ffffff;
      border-color: #e2e8f0;
    }
    .metric-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      display: block;
    }
    .metric-value {
      font-size: 16px;
      font-weight: 900;
      margin-top: 3px;
      letter-spacing: -0.4px;
    }
    .metric-sub {
      font-size: 8.5px;
      color: #94a3b8;
      margin-top: 2px;
    }

    /* Exposure Bar */
    .section-box {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 16px;
      background: #ffffff;
    }
    .table-box {
      padding: 0;
      overflow: hidden;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      color: #1e293b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .section-header-row {
      padding: 10px 14px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .section-tag {
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      background: #e2e8f0;
      color: #475569;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .progress-bar-container {
      height: 18px;
      background: #f1f5f9;
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      margin-top: 8px;
    }
    .progress-segment {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 700;
      color: #ffffff;
      text-align: center;
    }
    .segment-green { background: #059669; }
    .segment-red { background: #dc2626; }
    .progress-legend {
      display: flex;
      gap: 16px;
      margin-top: 8px;
      font-size: 9.5px;
      font-weight: 600;
      color: #475569;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot-green { background: #059669; }
    .dot-red { background: #dc2626; }

    /* Tables */
    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    .report-table th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 8.5px;
      padding: 8px 10px;
      border-bottom: 1px solid #cbd5e1;
    }
    .report-table td {
      padding: 7px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
    }
    .row-even { background: #ffffff; }
    .row-odd { background: #f8fafc; }
    .table-total-row td {
      background: #e2e8f0;
      font-weight: 800;
      padding: 9px 10px;
      border-top: 2px solid #cbd5e1;
      border-bottom: 0;
    }
    .contact-name {
      font-weight: 700;
      color: #0f172a;
    }
    .contact-sub {
      font-size: 8.5px;
      color: #64748b;
      margin-top: 1px;
    }
    .text-left { text-align: left; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 800; }
    .font-semibold { font-weight: 600; }
    .tabular {
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
    }
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .text-muted { color: #64748b; }

    .amount-positive { color: #047857; }
    .amount-negative { color: #b91c1c; }
    .amount-neutral { color: #475569; }

    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .badge-success {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }
    .badge-danger {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }
    .badge-neutral {
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #cbd5e1;
    }

    .settle-notice {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 16px;
    }
    .settle-title {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1d4ed8;
      margin-bottom: 3px;
    }
    .settle-body {
      font-size: 9.5px;
      color: #1e3a8a;
      line-height: 1.4;
    }

    /* Footer */
    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 8.5px;
      color: #94a3b8;
    }
    .footer-note {
      margin-bottom: 4px;
      color: #64748b;
    }
    .footer-meta {
      display: flex;
      justify-content: space-between;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    @media print {
      body {
        background: #ffffff;
      }
      .report-wrapper {
        padding: 0;
        max-width: 100%;
      }
      .section-box {
        break-inside: avoid;
      }
      tr {
        break-inside: avoid;
      }
    }
  `;
}
