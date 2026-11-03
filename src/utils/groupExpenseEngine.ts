import { ExpenseGroup, GroupExpense, GroupExpenseSplit, GroupSplitType, Debt } from '../types';
import { formatINR } from './formatters';

export interface MemberBalance {
  memberId: string;
  memberName: string;
  phone?: string;
  paid: number;
  owes: number;
  net: number; // > 0: owed money (creditor), < 0: owes money (debtor)
}

export interface SimplifiedDebtTransfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

/**
 * Get human-readable display name for group member
 */
export function getMemberDisplayName(
  memberId: string,
  debts: Debt[],
  userProfileName: string = 'You'
): string {
  if (memberId === 'user_me') return userProfileName || 'You';
  const found = debts.find((d) => d.id === memberId);
  return found ? found.personName : memberId;
}

export function getMemberPhone(memberId: string, debts: Debt[]): string | undefined {
  if (memberId === 'user_me') return undefined;
  const found = debts.find((d) => d.id === memberId);
  return found?.phone;
}

/**
 * Distribute total amount equally across active member IDs with paisa/rounding precision
 */
export function calculateEqualSplits(
  totalAmount: number,
  memberIds: string[]
): GroupExpenseSplit[] {
  if (memberIds.length === 0 || totalAmount <= 0) return [];
  const count = memberIds.length;
  const baseShare = Math.floor((totalAmount / count) * 100) / 100;
  let allocated = baseShare * count;
  let remainder = Math.round((totalAmount - allocated) * 100) / 100;

  return memberIds.map((id, index) => {
    let share = baseShare;
    if (remainder > 0.009) {
      share = Math.round((share + 0.01) * 100) / 100;
      remainder = Math.round((remainder - 0.01) * 100) / 100;
    }
    return {
      memberId: id,
      amount: share,
    };
  });
}

/**
 * Distribute total amount by unit shares (e.g. 1x, 2x)
 */
export function calculateSharesSplits(
  totalAmount: number,
  memberShares: { memberId: string; shares: number }[]
): GroupExpenseSplit[] {
  const totalShares = memberShares.reduce((acc, curr) => acc + (curr.shares || 0), 0);
  if (totalShares <= 0 || totalAmount <= 0) return [];

  let allocated = 0;
  const splits = memberShares.map((item, idx) => {
    if (idx === memberShares.length - 1) {
      const remaining = Math.max(0, Math.round((totalAmount - allocated) * 100) / 100);
      return {
        memberId: item.memberId,
        shares: item.shares,
        amount: remaining,
      };
    }
    const proportionalAmount = Math.round(((item.shares / totalShares) * totalAmount) * 100) / 100;
    allocated += proportionalAmount;
    return {
      memberId: item.memberId,
      shares: item.shares,
      amount: proportionalAmount,
    };
  });

  return splits;
}

/**
 * Distribute total amount by percentage (e.g. 50%, 25%, 25%)
 */
export function calculatePercentageSplits(
  totalAmount: number,
  memberPercents: { memberId: string; percentage: number }[]
): GroupExpenseSplit[] {
  let allocated = 0;
  return memberPercents.map((item, idx) => {
    if (idx === memberPercents.length - 1) {
      const remaining = Math.max(0, Math.round((totalAmount - allocated) * 100) / 100);
      return {
        memberId: item.memberId,
        percentage: item.percentage,
        amount: remaining,
      };
    }
    const amt = Math.round(((item.percentage / 100) * totalAmount) * 100) / 100;
    allocated += amt;
    return {
      memberId: item.memberId,
      percentage: item.percentage,
      amount: amt,
    };
  });
}

/**
 * Compute member balances across all expenses in a group
 */
export function calculateGroupBalances(
  group: ExpenseGroup,
  expenses: GroupExpense[],
  debts: Debt[],
  userProfileName: string = 'You'
): {
  totalSpent: number;
  userNetBalance: number;
  memberBalances: MemberBalance[];
  pairwiseDebts: SimplifiedDebtTransfer[];
} {
  const groupExpenses = expenses.filter((e) => e.groupId === group.id);
  const totalSpent = groupExpenses.reduce((sum, e) => sum + e.totalAmount, 0);

  // Initialize balance dictionary
  const balanceMap = new Map<string, { paid: number; owes: number }>();
  group.memberIds.forEach((mId) => {
    balanceMap.set(mId, { paid: 0, owes: 0 });
  });

  // Track direct pairwise debts without simplification
  // pairMap: payer -> borrower -> amount
  const pairMap = new Map<string, Map<string, number>>();
  const getPair = (from: string, to: string) => {
    return pairMap.get(from)?.get(to) || 0;
  };
  const addPair = (from: string, to: string, amt: number) => {
    if (!pairMap.has(from)) pairMap.set(from, new Map());
    const curr = pairMap.get(from)!.get(to) || 0;
    pairMap.get(from)!.set(to, curr + amt);
  };

  groupExpenses.forEach((exp) => {
    const payer = exp.paidBy;
    if (!balanceMap.has(payer)) {
      balanceMap.set(payer, { paid: 0, owes: 0 });
    }
    const pRecord = balanceMap.get(payer)!;
    pRecord.paid += exp.totalAmount;

    exp.splits.forEach((split) => {
      if (!balanceMap.has(split.memberId)) {
        balanceMap.set(split.memberId, { paid: 0, owes: 0 });
      }
      const mRecord = balanceMap.get(split.memberId)!;
      mRecord.owes += split.amount;

      if (split.memberId !== payer && split.amount > 0) {
        addPair(split.memberId, payer, split.amount);
      }
    });
  });

  const memberBalances: MemberBalance[] = Array.from(balanceMap.entries()).map(([mId, data]) => {
    const net = Math.round((data.paid - data.owes) * 100) / 100;
    return {
      memberId: mId,
      memberName: getMemberDisplayName(mId, debts, userProfileName),
      phone: getMemberPhone(mId, debts),
      paid: Math.round(data.paid * 100) / 100,
      owes: Math.round(data.owes * 100) / 100,
      net,
    };
  });

  const userBalance = memberBalances.find((m) => m.memberId === 'user_me');
  const userNetBalance = userBalance ? userBalance.net : 0;

  // Compute standard net-settled pairwise debts
  const pairwiseDebts: SimplifiedDebtTransfer[] = [];
  const processedPairs = new Set<string>();

  memberBalances.forEach((m1) => {
    memberBalances.forEach((m2) => {
      if (m1.memberId >= m2.memberId) return;
      const id1 = m1.memberId;
      const id2 = m2.memberId;
      const key = `${id1}_${id2}`;
      if (processedPairs.has(key)) return;
      processedPairs.add(key);

      const owes1to2 = getPair(id1, id2);
      const owes2to1 = getPair(id2, id1);
      const net = owes1to2 - owes2to1;

      if (net > 0.01) {
        pairwiseDebts.push({
          fromId: id1,
          fromName: m1.memberName,
          toId: id2,
          toName: m2.memberName,
          amount: Math.round(net * 100) / 100,
        });
      } else if (net < -0.01) {
        pairwiseDebts.push({
          fromId: id2,
          fromName: m2.memberName,
          toId: id1,
          toName: m1.memberName,
          amount: Math.round(Math.abs(net) * 100) / 100,
        });
      }
    });
  });

  return {
    totalSpent,
    userNetBalance,
    memberBalances,
    pairwiseDebts,
  };
}

/**
 * Simplify Debts (Min-Cash-Flow Algorithm)
 * Minimizes total number of transactions required to settle up all balances
 */
export function simplifyDebts(memberBalances: MemberBalance[]): SimplifiedDebtTransfer[] {
  // Filter into debtors (net < 0) and creditors (net > 0)
  interface PersonNet {
    id: string;
    name: string;
    amount: number;
  }

  const debtors: PersonNet[] = [];
  const creditors: PersonNet[] = [];

  memberBalances.forEach((m) => {
    if (m.net < -0.01) {
      debtors.push({ id: m.memberId, name: m.memberName, amount: Math.abs(m.net) });
    } else if (m.net > 0.01) {
      creditors.push({ id: m.memberId, name: m.memberName, amount: m.net });
    }
  });

  const transfers: SimplifiedDebtTransfer[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settledAmount = Math.min(debtor.amount, creditor.amount);

    if (settledAmount > 0.01) {
      transfers.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: Math.round(settledAmount * 100) / 100,
      });
    }

    debtor.amount = Math.round((debtor.amount - settledAmount) * 100) / 100;
    creditor.amount = Math.round((creditor.amount - settledAmount) * 100) / 100;

    if (debtor.amount <= 0.01) dIdx++;
    if (creditor.amount <= 0.01) cIdx++;
  }

  return transfers;
}

/**
 * Calculate remainder for exact splits
 */
export function calculateExactSplitsRemainder(
  totalAmount: number,
  exactSplits: { memberId: string; amount: number }[]
): number {
  const sum = exactSplits.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  return Math.round((totalAmount - sum) * 100) / 100;
}

export interface ExpenseClaimPayload {
  t: 'GROUP_EXPENSE';
  gName: string;
  title: string;
  amount: number;
  paidBy: string; // Payer name e.g. "Harshit" or "Harshit Sharma"
  shares: { name: string; amount: number; memberId?: string }[];
  date: string;
  time?: string;
  splitType?: string;
  note?: string;
}

/**
 * Public demo app URL for deep linking across devices via WhatsApp
 */
export const DEMO_APP_URL = 'https://ais-dev-q4aw6usgybbw7q2pzn34pg-126073079544.asia-northeast1.run.app';

/**
 * Generate URL-safe base64 encoded claim link for sharing
 */
export function generateShareLink(
  group: ExpenseGroup,
  expense: GroupExpense,
  debts: Debt[],
  userProfileName: string = 'You'
): string {
  const payerName = getMemberDisplayName(expense.paidBy, debts, userProfileName);
  const shares = expense.splits.map((s) => ({
    name: getMemberDisplayName(s.memberId, debts, userProfileName),
    amount: s.amount,
    memberId: s.memberId,
  }));

  const payload: ExpenseClaimPayload = {
    t: 'GROUP_EXPENSE',
    gName: group.name,
    title: expense.title,
    amount: expense.totalAmount,
    paidBy: payerName,
    shares,
    date: expense.date,
    time: expense.time,
    splitType: expense.splitType,
    note: expense.note,
  };

  try {
    const jsonStr = JSON.stringify(payload);
    const encodedData = btoa(unescape(encodeURIComponent(jsonStr)));
    // Provide demo link as requested ("now provide demo link only")
    return `${DEMO_APP_URL}?data=${encodedData}`;
  } catch (e) {
    return '';
  }
}

/**
 * Parse incoming base64 encoded claim payload from URL query parameter
 */
export function parseExpenseClaimPayload(encodedData: string): ExpenseClaimPayload | null {
  try {
    const jsonStr = decodeURIComponent(escape(atob(encodedData)));
    const parsed = JSON.parse(jsonStr);
    if (parsed && (parsed.t === 'GROUP_EXPENSE' || parsed.gName || parsed.title)) {
      return {
        t: 'GROUP_EXPENSE',
        gName: parsed.gName || 'Group Expense',
        title: parsed.title || 'Expense',
        amount: Number(parsed.amount) || 0,
        paidBy: parsed.paidBy || 'Contact',
        shares: Array.isArray(parsed.shares) ? parsed.shares : [],
        date: parsed.date || new Date().toISOString().split('T')[0],
        time: parsed.time,
        splitType: parsed.splitType || 'EQUAL',
        note: parsed.note,
      };
    }
  } catch (err) {
    console.error('Failed to parse claim payload', err);
  }
  return null;
}

/**
 * Generate formatted WhatsApp message and deep link for an expense
 */
export function generateExpenseWhatsAppShare(
  group: ExpenseGroup,
  expense: GroupExpense,
  debts: Debt[],
  userProfileName: string = 'You'
): { messageText: string; universalLink: string; deepLink: string; directLinks: { memberId: string; name: string; url: string; smsUri: string }[] } {
  const payerName = getMemberDisplayName(expense.paidBy, debts, userProfileName);
  const deepLink = generateShareLink(group, expense, debts, userProfileName);

  let text = `✈️ *${group.name}* - New Expense Added\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📌 *${expense.title}*: ₹${formatINR(expense.totalAmount)}\n`;
  text += `💳 *Paid by*: ${payerName}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `*Split Breakdown*:\n`;

  expense.splits.forEach((s) => {
    const mName = getMemberDisplayName(s.memberId, debts, userProfileName);
    text += `▫️ ${mName}: ₹${formatINR(s.amount)}\n`;
  });

  if (expense.note) {
    text += `\n📝 *Note*: ${expense.note}\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;

  if (deepLink) {
    text += `🧾 *Open & Sync Receipt in App*:\n${deepLink}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  }

  text += `⚡ Managed via FinSync · Log Split Track Analyse Grow`;

  const encodedText = encodeURIComponent(text);
  const universalLink = `whatsapp://send?text=${encodedText}`;

  // Direct contact links if phone numbers are available
  const directLinks = expense.splits
    .filter((s) => s.memberId !== 'user_me')
    .map((s) => {
      const name = getMemberDisplayName(s.memberId, debts, userProfileName);
      const phone = getMemberPhone(s.memberId, debts);
      const cleanDigits = phone ? phone.replace(/[^0-9]/g, '') : '';
      const url = cleanDigits
        ? `whatsapp://send?phone=${cleanDigits}&text=${encodedText}`
        : universalLink;
      const smsUri = cleanDigits ? `smsto:${cleanDigits}?body=${encodedText}` : `sms:?body=${encodedText}`;
      return {
        memberId: s.memberId,
        name,
        url,
        smsUri,
      };
    });

  return {
    messageText: text,
    universalLink,
    deepLink,
    directLinks,
  };
}

/**
 * Generate formatted WhatsApp message for Group Settlement / Settle-Up Reminder
 */
export function generateSettlementWhatsAppShare(
  groupName: string,
  fromName: string,
  toName: string,
  amount: number,
  phone?: string
): { messageText: string; link: string; smsUri: string } {
  const statusFlag = amount > 0 ? '🔴' : '🟢';
  const messageText = [
    `🤝 *${groupName} - Settle Up*`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `💰 *Amount:* ₹${formatINR(amount)}`,
    `👤 *From:* ${fromName}`,
    `🎯 *To:* ${toName}`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `${statusFlag} Please settle this pending balance via UPI or Cash.`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `⚡ Recorded via FinSync · Log Split Track Analyse Grow`,
  ].join('\n');

  const cleanDigits = phone ? phone.replace(/[^0-9]/g, '') : '';
  const link = cleanDigits
    ? `whatsapp://send?phone=${cleanDigits}&text=${encodeURIComponent(messageText)}`
    : `whatsapp://send?text=${encodeURIComponent(messageText)}`;
  const smsUri = cleanDigits
    ? `smsto:${cleanDigits}?body=${encodeURIComponent(messageText)}`
    : `sms:?body=${encodeURIComponent(messageText)}`;

  return {
    messageText,
    link,
    smsUri,
  };
}
