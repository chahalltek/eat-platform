'use client';

import { useState } from "react";

interface TenantExportButtonProps {
  tenantId: string;
}

export function TenantExportButton({ tenantId }: TenantExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch("/api/tenant/export", { method: "POST" });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error || "Unable to start export. Please try again.");
        return;
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `tenant-${tenantId}-export.zip`;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (exportError) {
      console.error("Failed to export tenant data", exportError);
      setError("Something went wrong. Please retry.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isExporting ? "Preparing export..." : "Export tenant data"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {isExporting ? (
        <p className="text-sm text-zinc-600">This may take a few moments. Large tenants can take longer to bundle.</p>
      ) : null}
    </div>
  );
}
