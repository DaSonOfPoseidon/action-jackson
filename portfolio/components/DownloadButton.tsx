"use client";

import { useState } from "react";
import type { ResumeData } from "@/lib/types";

interface DownloadButtonProps {
  resumeData: ResumeData;
}

export function DownloadButton({ resumeData }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { ResumePDF } = await import("@/components/ResumePDF");

      const blob = await pdf(<ResumePDF data={resumeData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Jackson_Keithley_Resume.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback to static PDF
      const link = document.createElement("a");
      link.href = "/resume.pdf";
      link.download = "Jackson_Keithley_Resume.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple/10 border border-purple/30 text-purple hover:bg-purple/20 hover:border-purple/50 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {loading ? "Generating..." : "Download PDF"}
    </button>
  );
}
