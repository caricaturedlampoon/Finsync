import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Account } from '../../types';
import { formatINR, toInputDate } from '../../utils/formatters';
import { AccountAvatar } from '../common/AccountAvatar';
import {
  STOCKS_CSV_SAMPLE,
  MUTUAL_FUNDS_CSV_SAMPLE,
  downloadCSVTemplate,
} from '../../utils/investmentCsvEngine';
import {
  X,
  ArrowLeft,
  FileSpreadsheet,
  Download,
  Upload,
  TrendingUp,
  Check,
  AlertCircle,
  HelpCircle,
  Building2,
  PieChart,
  Landmark,
  ArrowRightLeft,
} from 'lucide-react';

export const InvestmentCSVModal: React.FC = () => {
  const {
    isInvestmentCSVModalOpen,
    setIsInvestmentCSVModalOpen,
    accounts,
    importStocksWithTransfers,
    importMutualFundsWithTransfers,
    exportStocksCSVData,
    exportMutualFundsCSVData,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'stocks' | 'mutual_funds'>('stocks');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>(() => {
    const defaultBank = accounts.find((a) => a.type === 'bank' && !a.isArchived) || accounts[0];
    return defaultBank ? defaultBank.id : '';
  });
  const [selectedDematAccountId, setSelectedDematAccountId] = useState<string>(() => {
    const defaultDemat = accounts.find((a) => a.type === 'demat' && !a.isArchived) || accounts.find((a) => a.type === 'demat') || accounts[0];
    return defaultDemat ? defaultDemat.id : '';
  });
  const [fileName, setFileName] = useState<string>('');
  const [csvContent, setCsvContent] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isInvestmentCSVModalOpen) return null;

  const handleClose = () => {
    setIsInvestmentCSVModalOpen(false);
    setFileName('');
    setCsvContent('');
    setErrorMsg('');
    setIsProcessing(false);
  };

  // Only active bank, cash, or wallet accounts can fund investments
  const eligibleFundingAccounts = accounts.filter(
    (a) => !a.isArchived && !a.isSystemDebtAccount && (a.type === 'bank' || a.type === 'cash' || a.type === 'wallet')
  );

  // Demat accounts where imported holdings will be held
  const eligibleDematAccounts = accounts.filter(
    (a) => !a.isArchived && !a.isSystemDebtAccount && a.type === 'demat'
  );
  const dematAccountsToDisplay = eligibleDematAccounts.length > 0 ? eligibleDematAccounts : accounts.filter((a) => !a.isArchived && !a.isSystemDebtAccount);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setErrorMsg('Please select a valid .csv file');
      return;
    }

    try {
      const text = await file.text();
      setFileName(file.name);
      setCsvContent(text);
      setErrorMsg('');
    } catch (err: any) {
      setErrorMsg('Failed to read CSV file content: ' + (err.message || 'Unknown error'));
    }
  };

  const handleExecuteImport = () => {
    if (!selectedBankAccountId) {
      setErrorMsg('Please select a funding bank account before importing.');
      return;
    }
    if (!csvContent.trim()) {
      setErrorMsg('Please upload a CSV file with investment transaction rows.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    try {
      if (activeTab === 'stocks') {
        const res = importStocksWithTransfers(csvContent, selectedBankAccountId, {
          fileName: fileName || 'Stocks_Import.csv',
          dematAccountId: selectedDematAccountId,
        });
        if (res.success) {
          handleClose();
        } else {
          setErrorMsg(res.message);
        }
      } else {
        const res = importMutualFundsWithTransfers(csvContent, selectedBankAccountId, {
          fileName: fileName || 'Mutual_Funds_Import.csv',
          dematAccountId: selectedDematAccountId,
        });
        if (res.success) {
          handleClose();
        } else {
          setErrorMsg(res.message);
        }
      }

    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during import.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSample = () => {
    if (activeTab === 'stocks') {
      downloadCSVTemplate('Sample_Stocks_Import_Template.csv', STOCKS_CSV_SAMPLE);
    } else {
      downloadCSVTemplate('Sample_Mutual_Funds_Import_Template.csv', MUTUAL_FUNDS_CSV_SAMPLE);
    }
  };

  const selectedAccount = accounts.find((a) => a.id === selectedBankAccountId);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-950 flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-150">
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 border-x border-slate-200 dark:border-slate-800 shadow-xl">
        {/* Fullscreen Sticky Header */}
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0"
              title="Back to Investments"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Investments</span>
            </button>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                Investment CSV Data Entry
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Import Stocks & Mutual Funds with automated average share price and passbook transfers
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60">
          <button
            onClick={() => {
              setActiveTab('stocks');
              setCsvContent('');
              setFileName('');
              setErrorMsg('');
            }}
            className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'stocks'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Stocks CSV Import</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('mutual_funds');
              setCsvContent('');
              setFileName('');
              setErrorMsg('');
            }}
            className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'mutual_funds'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>Mutual Funds CSV Import</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
          {/* Step 1: Select Funding Bank Account (Requirement: Ask from user before importing) */}
          <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                  1. Settlement / Funding Bank Account
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select which bank account funds Buy purchases (Debit) or receives Sell redemption proceeds (Credit).
                </p>
              </div>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {eligibleFundingAccounts.map((acc) => {
                const isSelected = acc.id === selectedBankAccountId;
                return (
                  <div
                    key={acc.id}
                    onClick={() => setSelectedBankAccountId(acc.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-emerald-500 dark:border-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-xs ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 hover:border-slate-300 dark:hover:border-slate-600 text-slate-900 dark:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <AccountAvatar account={acc} size="sm" />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white text-xs block">
                          {acc.name}
                        </span>
                        <span className="text-[11px] text-slate-400 capitalize">
                          {acc.type} {acc.accountNumber ? `(...${acc.accountNumber})` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-xs text-slate-900 dark:text-white tabular-nums block">
                        {formatINR(acc.balance)}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5 justify-end">
                          <Check className="w-3 h-3" /> Selected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Select Demat / Custody Account */}
          <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                  2. Target Demat / Custody Account
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select which Demat account receives the imported holdings and tracks the investment valuation.
                </p>
              </div>
              <Landmark className="w-4 h-4 text-purple-500" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {dematAccountsToDisplay.map((acc) => {
                const isSelected = acc.id === selectedDematAccountId;
                return (
                  <div
                    key={acc.id}
                    onClick={() => setSelectedDematAccountId(acc.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-purple-500 dark:border-purple-400 bg-purple-50/70 dark:bg-purple-950/40 shadow-xs ring-2 ring-purple-500/20'
                        : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 hover:border-slate-300 dark:hover:border-slate-600 text-slate-900 dark:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <AccountAvatar account={acc} size="sm" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-white text-xs block">
                            {acc.name}
                          </span>
                          {acc.type === 'demat' && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 rounded">
                              Demat
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 capitalize">
                          {acc.type} {acc.accountNumber ? `(...${acc.accountNumber})` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-xs text-slate-900 dark:text-white tabular-nums block">
                        {formatINR(acc.balance)}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-0.5 justify-end">
                          <Check className="w-3 h-3" /> Selected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Transfer flow summary */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 text-xs">
              <ArrowRightLeft className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-purple-900 dark:text-purple-200">
                  Transfer Flow: <span className="underline">{accounts.find((a) => a.id === selectedBankAccountId)?.name || 'Bank'}</span> ➔ <span className="underline">{accounts.find((a) => a.id === selectedDematAccountId)?.name || 'Demat'}</span>
                </span>
                <p className="text-[10px] text-purple-600/90 dark:text-purple-300">
                  Imported investment buys will transfer funds directly from bank to Demat. Demat balance is dynamically calculated with holding values.
                </p>
              </div>
            </div>
          </div>

          {/* Step 3: Schema Spec & Sample Template Download */}
          <div className="p-4 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                  {activeTab === 'stocks' ? 'Required Columns (Stocks CSV)' : 'Required Columns (Mutual Funds CSV)'}
                </h4>
                <p className="text-xs text-blue-800/80 dark:text-blue-400/80 mt-1">
                  {activeTab === 'stocks' ? (
                    <>
                      <code className="font-mono bg-blue-100/70 dark:bg-blue-900/60 px-1 py-0.5 rounded text-[11px]">
                        Stock Name, Symbol, ISIN, Type (Buy/Sell/Split/Bonus), Qty, Value, Date
                      </code>
                      <br />
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 block">
                        • Supports <strong>Buy</strong>, <strong>Sell</strong>, <strong>Split</strong>, and <strong>Bonus</strong> actions.
                        <br />
                        • <strong>Average share price</strong> = <code>Value / Qty</code>. For Split/Bonus, Value can be 0.
                        <br />
                        • Trade dates are validated against future dates and normalized automatically.
                      </span>
                    </>
                  ) : (
                    <>
                      <code className="font-mono bg-blue-100/70 dark:bg-blue-900/60 px-1 py-0.5 rounded text-[11px]">
                        Scheme Name, Transaction Type, Units, NAV, Amount, Date
                      </code>
                      <br />
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 block">
                        • Transaction Type: <strong>Purchase</strong> (Buy) or <strong>Redeem</strong> (Sell).
                        <br />
                        • Dates are validated against future dates and normalized automatically.
                      </span>
                    </>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadSample}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-semibold hover:bg-blue-50 transition-colors shrink-0 shadow-xs cursor-pointer"
                title="Download template CSV with sample rows"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample CSV</span>
              </button>
            </div>
          </div>

          {/* Step 4: File Upload & Dropzone */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
              3. Upload {activeTab === 'stocks' ? 'Stocks' : 'Mutual Funds'} CSV File
            </span>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50/50 dark:bg-slate-800/30 transition-all group"
            >
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Upload className="w-5 h-5" />
              </div>

              {fileName ? (
                <div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white block">
                    {fileName}
                  </span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 inline-block">
                    ✓ File loaded ready to import
                  </span>
                </div>
              ) : (
                <div>
                  <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 block">
                    Click to browse or drop your CSV file here
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Supports comma-separated UTF-8 CSV exports from Zerodha, Groww, ICICI Direct, CAMs, KFintech
                  </span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Portfolio Export Section */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
              Export Existing Portfolio Ledgers
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => exportStocksCSVData()}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-blue-500" />
                <span>Export Stocks CSV</span>
              </button>

              <button
                type="button"
                onClick={() => exportMutualFundsCSVData()}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-500" />
                <span>Export Mutual Funds CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons Sticky Footer */}
        <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={!csvContent || isProcessing || !selectedBankAccountId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>
              {isProcessing
                ? 'Processing...'
                : `Import ${activeTab === 'stocks' ? 'Stocks' : 'Mutual Funds'} & Log Transfers`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
