/**
 * Loan Amortization Engine
 * Handles standard EMI computation, monthly schedule breakdown,
 * historical catch-up generation, and visual analytics ratios.
 */

import { Loan, Transaction, Account } from '../types';

export interface AmortizationScheduleRow {
  monthIndex: number;
  date: string; // YYYY-MM-DD
  openingBalance: number;
  emi: number;
  principal: number;
  interest: number;
  closingBalance: number;
  isHistorical: boolean;
}

export interface LoanFinancialSummary {
  loan: Loan;
  totalBorrowing: number;
  principalPaid: number;
  principalRemaining: number;
  cumulativeInterestPaid: number;
  totalAmountPaid: number; // Principal + Interest
  repaymentProgressPercent: number; // Principal Paid / Total Borrowing %
  interestToPrincipalRatio: number; // Interest / (Principal + Interest) %
  monthsCompleted: number;
  estimatedMonthsRemaining: number;
  nextDueDate: string | null;
  isFullyPaid: boolean;
}

/**
 * Calculate standard Equated Monthly Installment (EMI)
 * Formula: [P x R x (1+R)^N]/[(1+R)^N-1]
 */
export function calculateMonthlyEmi(
  principal: number,
  annualInterestRatePercent: number,
  tenureMonths: number
): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  if (annualInterestRatePercent <= 0) {
    return Math.round((principal / tenureMonths) * 100) / 100;
  }

  const monthlyRate = annualInterestRatePercent / (12 * 100);
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = (principal * monthlyRate * factor) / (factor - 1);

  return Math.round(emi);
}


/**
 * Construct an ISO payment date string (YYYY-MM-DD) for a given year, month, and day of month
 */
function createPaymentDateString(year: number, monthIndex: number, day: number): string {
  // Ensure valid date within month bounds (e.g. Feb 28/29, April 30)
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  const clampedDay = Math.min(day, lastDayOfMonth);
  const d = new Date(year, monthIndex, clampedDay);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Generate full amortization schedule for a loan
 */
export function generateAmortizationSchedule(loan: Loan): AmortizationScheduleRow[] {
  const schedule: AmortizationScheduleRow[] = [];
  if (!loan || loan.totalAmount <= 0) return schedule;

  const start = new Date(loan.startDate);
  const startYear = isNaN(start.getFullYear()) ? new Date().getFullYear() : start.getFullYear();
  const startMonth = isNaN(start.getMonth()) ? new Date().getMonth() : start.getMonth();
  const paymentDay = loan.paymentDay || 5;

  const todayStr = new Date().toISOString().split('T')[0];
  const monthlyRate = (loan.interestRate || 0) / (12 * 100);

  let currentBalance = loan.totalAmount;
  let month = 0;
  const maxMonths = 360; // 30 year safety bound

  while (currentBalance > 1 && month < maxMonths) {
    const openingBalance = currentBalance;
    const interest = Math.round(openingBalance * monthlyRate * 100) / 100;
    
    // Principal component
    let emi = loan.emiAmount;
    let principal = emi - interest;

    if (principal > openingBalance || openingBalance + interest <= emi) {
      principal = openingBalance;
      emi = principal + interest;
      currentBalance = 0;
    } else {
      currentBalance = Math.round((openingBalance - principal) * 100) / 100;
    }

    const paymentDate = createPaymentDateString(startYear, startMonth + month, paymentDay);
    const isHistorical = paymentDate <= todayStr;

    schedule.push({
      monthIndex: month + 1,
      date: paymentDate,
      openingBalance,
      emi,
      principal,
      interest,
      closingBalance: currentBalance,
      isHistorical,
    });

    month++;
  }

  return schedule;
}

/**
 * Generate Historical EMI Transactions to auto-catchup from Start Date to Current Date
 */
export function generateHistoricalEmiCatchup(params: {
  loan: Loan;
  fundingAccount: Account;
  loanAccount: Account;
  interestCategory: { id: string; name: string };
}): {
  transactions: Array<{
    amount: number;
    type: 'transfer' | 'expense';
    fromAccountId: string;
    fromAccountName: string;
    toAccountId?: string;
    toAccountName?: string;
    categoryId?: string;
    categoryName?: string;
    date: string;
    note: string;
    tags: string[];
    loanId?: string;
    createdAt: string;
  }>;
} {
  const { loan, fundingAccount, loanAccount, interestCategory } = params;
  const transactions: Array<{
    amount: number;
    type: 'transfer' | 'expense';
    fromAccountId: string;
    fromAccountName: string;
    toAccountId?: string;
    toAccountName?: string;
    categoryId?: string;
    categoryName?: string;
    date: string;
    note: string;
    tags: string[];
    loanId?: string;
    createdAt: string;
  }> = [];

  const schedule = generateAmortizationSchedule(loan);
  const historicalRows = schedule.filter((row) => row.isHistorical);

  historicalRows.forEach((row) => {
    // 1. Principal Payment -> Transfer from Funding Bank to Loan Account (reduces negative loan balance)
    if (row.principal > 0) {
      transactions.push({
        amount: Math.round(row.principal * 100) / 100,
        type: 'transfer',
        fromAccountId: fundingAccount.id,
        fromAccountName: fundingAccount.name,
        toAccountId: loanAccount.id,
        toAccountName: loanAccount.name,
        date: row.date,
        note: `${loan.name} - EMI #${row.monthIndex} Principal Repayment`,
        tags: ['loan', 'emi', 'principal', loan.name.toLowerCase()],
        loanId: loan.id,
        createdAt: new Date().toISOString(),
      });
    }

    // 2. Interest Component -> Expense from Funding Bank under category "Interest Paid"
    if (row.interest > 0) {
      transactions.push({
        amount: Math.round(row.interest * 100) / 100,
        type: 'expense',
        fromAccountId: fundingAccount.id,
        fromAccountName: fundingAccount.name,
        categoryId: interestCategory.id,
        categoryName: interestCategory.name,
        date: row.date,
        note: `${loan.name} - EMI #${row.monthIndex} Interest Component (${loan.interestRate}% p.a.)`,
        tags: ['loan', 'emi', 'interest', loan.name.toLowerCase()],
        loanId: loan.id,
        createdAt: new Date().toISOString(),
      });
    }
  });

  return { transactions };
}

/**
 * Calculate comprehensive real-time financial summary for a loan
 */
export function calculateLoanSummary(
  loan: Loan,
  allTransactions: Transaction[],
  allAccounts: Account[]
): LoanFinancialSummary {
  const loanAcc = allAccounts.find((a) => a.id === loan.loanAccountId);
  const totalBorrowing = loan.totalAmount;

  // Real ledger-calculated principal remaining:
  // If loan account exists, its balance starts at -totalAmount and goes up towards 0
  let principalRemaining = totalBorrowing;
  if (loanAcc) {
    principalRemaining = Math.max(0, Math.abs(loanAcc.balance));
  }

  // Principal paid = Total borrowing - remaining
  let principalPaid = Math.max(0, totalBorrowing - principalRemaining);

  // Cumulative interest paid: sum of all expenses where category is Interest Paid and note matches this loan
  let cumulativeInterestPaid = 0;
  allTransactions.forEach((tx) => {
    if (
      tx.type === 'expense' &&
      (tx.categoryName === 'Interest Paid' || (tx.tags && tx.tags.includes('interest'))) &&
      (tx.note.includes(loan.name) || (tx.tags && tx.tags.includes(loan.name.toLowerCase())))
    ) {
      cumulativeInterestPaid += tx.amount;
    }
  });

  const totalAmountPaid = principalPaid + cumulativeInterestPaid;
  const repaymentProgressPercent = totalBorrowing > 0
    ? Math.min(100, (principalPaid / totalBorrowing) * 100)
    : 100;

  const totalComponent = principalPaid + cumulativeInterestPaid;
  const interestToPrincipalRatio = totalComponent > 0
    ? (cumulativeInterestPaid / totalComponent) * 100
    : 0;

  // Next due date calculation
  const schedule = generateAmortizationSchedule(loan);
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingRow = schedule.find((row) => row.date >= todayStr && row.closingBalance > 0);
  const nextDueDate = upcomingRow ? upcomingRow.date : null;

  const monthsCompleted = schedule.filter((row) => row.isHistorical).length;
  const estimatedMonthsRemaining = schedule.filter((row) => !row.isHistorical).length;

  return {
    loan,
    totalBorrowing,
    principalPaid,
    principalRemaining,
    cumulativeInterestPaid,
    totalAmountPaid,
    repaymentProgressPercent,
    interestToPrincipalRatio,
    monthsCompleted,
    estimatedMonthsRemaining,
    nextDueDate,
    isFullyPaid: principalRemaining <= 1,
  };
}
