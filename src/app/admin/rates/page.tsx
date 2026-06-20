"use client";

import Header from "@/components/layout/Header";
import { useState, useRef } from "react";
import { Upload, FileUp, AlertTriangle, Download, FileSpreadsheet, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RatesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/rates/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ success: false, message: "Upload failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    // In a real app, this would trigger an endpoint that generates the template.
    // For now, we redirect to a static file or a mock endpoint.
    window.open("/api/rates/template", "_blank");
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50 relative">
      {/* Subtle background ambient glow */}
      <div className="absolute top-20 right-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-[100px] pointer-events-none" />
      
      <Header title="Rate Cards" user={{ name: "Admin", email: "admin@asaind.co.in", role: "SUPER_ADMIN" }} />
      
      <div className="p-6 relative z-10 max-w-4xl mx-auto w-full space-y-6 mt-6">
        
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Upload Rate Card Master</h2>
              <p className="text-sm text-gray-500 mt-1">
                Upload center-wise rate cards to automatically calculate expected billing.
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl border border-[#003887]/20 text-[#003887] hover:bg-[#003887]/5 transition-colors shadow-sm bg-white"
            >
              <Download className="w-4 h-4" /> Download Template
            </button>
          </div>

          <div
            className={cn(
              "border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 relative overflow-hidden group",
              isDragging ? "border-[#003887] bg-blue-50/50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50",
              file && "border-green-400 bg-green-50/30"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const dropped = e.dataTransfer.files[0];
              if (dropped && (dropped.name.endsWith('.xlsx') || dropped.name.endsWith('.csv'))) {
                setFile(dropped);
              }
            }}
          >
            <input 
              type="file" 
              accept=".csv, .xlsx, .xls"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="hidden"
              ref={fileInputRef}
            />

            {file ? (
              <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-4 border border-green-100">
                  <FileSpreadsheet className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-lg font-semibold text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                
                <div className="flex items-center gap-3 mt-8">
                  <button
                    onClick={() => setFile(null)}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-white bg-white/50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all flex items-center gap-2 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                    style={{ background: "#003887" }}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {loading ? "Processing..." : "Import Rates"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-5 border border-gray-100 transition-transform duration-500 group-hover:scale-110">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-base font-medium text-gray-700">Drag & drop your rate card file here</p>
                <p className="text-sm text-gray-500 mt-1 mb-6">Supports .xlsx and .csv</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#003887] bg-white border border-gray-200 shadow-sm hover:border-[#003887]/30 transition-colors"
                >
                  Browse Files
                </button>
              </div>
            )}
          </div>

          {result && (
            <div className={cn(
              "mt-6 p-5 rounded-2xl border flex items-start gap-4 animate-in slide-in-from-bottom-4 duration-500",
              result.success ? "bg-emerald-50/50 border-emerald-200" : "bg-rose-50/50 border-rose-200"
            )}>
              <div className={cn("p-2 rounded-xl", result.success ? "bg-emerald-100/50" : "bg-rose-100/50")}>
                {result.success ? <FileUp className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
              </div>
              <div className="flex-1">
                <h3 className={cn("font-semibold text-base", result.success ? "text-emerald-800" : "text-rose-800")}>
                  {result.message}
                </h3>
                {result.success && (
                  <p className="text-sm text-emerald-700 mt-1">
                    Successfully imported {result.records} rate records.
                    {result.errors > 0 && ` Failed to import ${result.errors} records.`}
                  </p>
                )}
                {result.errorLog && result.errorLog.length > 0 && (
                  <ul className="mt-3 text-sm text-rose-600 list-disc list-inside space-y-1 bg-white/50 p-3 rounded-lg">
                    {result.errorLog.map((err: string, i: number) => <li key={i}>{err}</li>)}
                  </ul>
                )}
              </div>
              <button onClick={() => setResult(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
