import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  ArrowLeft,
  Download,
  Printer,
  FileCode,
  Share2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Check,
  Sun,
  Moon,
  Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { exportHtmlStringToPdf, printIframe } from '../../utils/pdfExportHelper';
import { fileService } from '../../services/fileService';
import { useRegisterOverlay } from '../../navigation/NavigationContext';

export const HtmlReportViewerModal: React.FC = () => {
  const {
    isHtmlReportViewerOpen,
    closeHtmlReportViewer,
    htmlReportPayload,
    showToast,
  } = useApp();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewMode, setViewMode] = useState<'sheet' | 'fluid'>('sheet');
  const [canvasTheme, setCanvasTheme] = useState<'dark' | 'light'>('dark');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportProgressMsg, setExportProgressMsg] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Reset zoom and view mode when report changes
  useEffect(() => {
    if (isHtmlReportViewerOpen) {
      setZoomLevel(100);
      setIsExportingPdf(false);
      setExportProgressMsg('');
    }
  }, [isHtmlReportViewerOpen, htmlReportPayload]);

  if (!isHtmlReportViewerOpen || !htmlReportPayload) {
    return null;
  }

  const { htmlContent, title, fileName, badge = 'HTML Audit Report', subtitle } = htmlReportPayload;

  // Zoom handlers
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 15, 175));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 15, 60));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  // High-Resolution PDF Download Action
  const handleDownloadPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setExportProgressMsg('Preparing publication PDF...');

    try {
      const pdfFileName = fileName.endsWith('.pdf') ? fileName : `${fileName.replace(/\.[^/.]+$/, '')}.pdf`;
      await exportHtmlStringToPdf(htmlContent, {
        fileName: pdfFileName,
        reportTitle: title,
        widthPx: 800,
        scale: 2.8, // 300 DPI razor-sharp vector/canvas resolution
        imageQuality: 0.96, // Maximum crispness, zero fuzzy JPEG artifacts
        sourceIframe: iframeRef.current,
        onProgress: (msg) => {
          setExportProgressMsg(msg);
        },
      });
      showToast('Crisp publication PDF saved and shared successfully!', 'success');
    } catch (err) {
      console.error('Failed to export PDF from HTML viewer', err);
      showToast('PDF compilation error. Downloading standalone HTML...', 'error');
      handleDownloadHtml();
    } finally {
      setIsExportingPdf(false);
      setExportProgressMsg('');
    }
  };

  // Direct In-App System Print Action (Native vector print / Save as PDF)
  const handlePrint = () => {
    if (iframeRef.current) {
      const printed = printIframe(iframeRef.current);
      if (printed) {
        showToast('Print dialog launched. Select "Save as PDF" for 100% native vector typography.', 'info');
        return;
      }
    }
    showToast('Launching print dialog...', 'info');
  };

  // Standalone HTML File Download Action
  const handleDownloadHtml = () => {
    const htmlFileName = fileName.endsWith('.html') ? fileName : `${fileName.replace(/\.[^/.]+$/, '')}.html`;
    fileService.exportAndShare({
      filename: htmlFileName,
      content: htmlContent,
      mimeType: 'text/html;charset=utf-8;',
      title: title,
      dialogTitle: 'Save or Share HTML Report',
    });
    showToast('HTML Dossier file saved to device.', 'success');
  };

  // Share Action
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `${title} - FinSync Financial Dossier`,
        });
        return;
      } catch {
        // Fallback to file download
      }
    }
    handleDownloadHtml();
  };

  // Copy HTML source
  const handleCopyHtml = async () => {
    try {
      await navigator.clipboard.writeText(htmlContent);
      setIsCopied(true);
      showToast('HTML report source copied to clipboard!', 'success');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex flex-col h-[100dvh] w-full bg-slate-900 text-slate-100 overflow-hidden animate-in fade-in duration-200">
      {/* 1. Top Primary Action Bar */}
      <header className="shrink-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3.5 sm:px-6 py-2.5 pt-safe flex items-center justify-between gap-2.5 z-20 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={closeHtmlReportViewer}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Back / Close"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-4.5 h-4.5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                {title}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shrink-0">
                <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                <span>{badge}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate hidden sm:block">
              {subtitle || 'Interactive in-app HTML view · Razor-sharp PDF download available'}
            </p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Download PDF Button */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-900/30 active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            title="Download razor-sharp publication PDF report"
          >
            <Download className={`w-3.5 h-3.5 ${isExportingPdf ? 'animate-bounce' : ''}`} />
            <span>{isExportingPdf ? 'Compiling PDF...' : 'Download PDF'}</span>
          </button>

          {/* Print / System PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs transition-colors cursor-pointer"
            title="Direct print / Save as vector PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Print / System PDF</span>
          </button>

          {/* Download HTML */}
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
            title="Download standalone HTML file"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden lg:inline">Save HTML</span>
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Share report"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={closeHtmlReportViewer}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. Secondary Interactive Control Ribbon */}
      <div className="shrink-0 bg-slate-850 border-b border-slate-800 px-3.5 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs z-10">
        {/* Left: View Mode Toggle */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center p-0.5 bg-slate-900 rounded-xl border border-slate-750">
            <button
              type="button"
              onClick={() => setViewMode('sheet')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                viewMode === 'sheet'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="A4 Print Page Sheet Preview (exact printed layout)"
            >
              A4 Sheet Mode
            </button>
            <button
              type="button"
              onClick={() => setViewMode('fluid')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                viewMode === 'fluid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Fluid Full-Width Responsive View"
            >
              Fit Screen
            </button>
          </div>

          <span className="text-slate-500 hidden sm:inline">|</span>

          {/* Canvas Desk Theme */}
          <button
            type="button"
            onClick={() => setCanvasTheme(canvasTheme === 'dark' ? 'light' : 'dark')}
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer text-[11px]"
            title="Toggle preview canvas background contrast"
          >
            {canvasTheme === 'dark' ? (
              <>
                <Moon className="w-3 h-3 text-indigo-400" />
                <span>Dark Canvas</span>
              </>
            ) : (
              <>
                <Sun className="w-3 h-3 text-amber-400" />
                <span>Light Canvas</span>
              </>
            )}
          </button>
        </div>

        {/* Center: Quality Hint Banner */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-400">
          <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>HTML rendered with embedded vector charts · 300 DPI export</span>
        </div>

        {/* Right: Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 60}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
            title="Zoom Out (-15%)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 font-mono text-[11px] font-bold transition-colors cursor-pointer tabular-nums"
            title="Reset Zoom to 100%"
          >
            {zoomLevel}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 175}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
            title="Zoom In (+15%)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Exporting Progress Toast Banner */}
      {isExportingPdf && (
        <div className="shrink-0 bg-emerald-950/90 border-b border-emerald-800 px-4 py-2 flex items-center justify-center gap-2 text-xs text-emerald-200 animate-pulse z-10">
          <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="font-semibold">{exportProgressMsg || 'Generating publication-grade PDF...'}</span>
        </div>
      )}

      {/* 3. Main Document Canvas Viewport */}
      <div
        className={`flex-1 overflow-auto transition-colors ${
          viewMode === 'fluid'
            ? 'p-0 flex flex-col items-stretch justify-start'
            : 'p-2 sm:p-6 flex items-start justify-center'
        } ${canvasTheme === 'dark' ? 'bg-slate-950' : 'bg-slate-200/80'}`}
      >
        <div
          style={{
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className={`transition-all duration-200 ${
            viewMode === 'sheet'
              ? 'w-full max-w-[880px] shadow-2xl rounded-2xl overflow-hidden bg-white ring-1 ring-slate-800/10 dark:ring-white/10 my-1 sm:my-3'
              : 'w-full flex-1 flex flex-col max-w-none rounded-none bg-white'
          }`}
        >
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            title={title}
            className="w-full border-0 bg-white block flex-1"
            style={{
              height: viewMode === 'sheet' ? 'calc(100dvh - 140px)' : 'calc(100dvh - 110px)',
              minHeight: viewMode === 'sheet' ? '650px' : 'calc(100dvh - 110px)',
            }}
          />
        </div>
      </div>

      {/* 4. Bottom Footer Info Bar */}
      <footer className="shrink-0 bg-slate-900 border-t border-slate-800 px-4 sm:px-6 py-2 pb-safe flex items-center justify-between text-[11px] text-slate-400 z-10">
        <div className="flex items-center gap-2 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="truncate">
            FinSync Report Engine · Publication-grade HTML & vector PDF dossier
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCopyHtml}
            className="hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
            title="Copy HTML code"
          >
            {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <FileCode className="w-3 h-3 text-slate-400" />}
            <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Copy HTML'}</span>
          </button>
          <span>·</span>
          <span className="font-mono text-slate-500">A4 210×297mm</span>
        </div>
      </footer>
    </div>
  );
};
