import React, { useState, useEffect } from 'react';
import {
  Code2,
  Copy,
  Check,
  Download,
  FileCode,
  FolderTree,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';
import type { CodeFile } from '../../server/nextjsArtifacts';

export default function NextjsCodeView() {
  const [artifacts, setArtifacts] = useState<CodeFile[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/code-artifacts')
      .then((res) => res.json())
      .then((data) => {
        setArtifacts(data);
        setLoading(false);
      })
      .catch((e) => console.error(e));
  }, []);

  const currentFile = artifacts[selectedFileIndex];

  const handleCopy = () => {
    if (!currentFile) return;
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!currentFile) return;
    const blob = new Blob([currentFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.path.split('/').pop() || 'file.ts';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-[#0f172a] text-white rounded-xl p-4 shadow-xs border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold border border-indigo-500/30">
                Next.js 14 App Router + Prisma + NextAuth + Nodemailer
              </span>
            </div>
            <h1 className="text-base font-bold text-white mt-1">Archivos de Producción Listos para Copiar</h1>
            <p className="text-xs text-slate-400">
              Módulos completos generados para tu repositorio Next.js: esquemas, Server Actions y plantillas Nodemailer.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Copiar Archivo'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: File Tree */}
        <div className="lg:col-span-4 space-y-2">
          <div className="bg-white rounded-lg shadow-xs border border-slate-200 p-3">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FolderTree className="w-3 h-3 text-slate-400" />
                Estructura del Proyecto
              </span>
              <span className="bg-slate-100 text-slate-700 font-mono px-1.5 py-0.5 rounded text-[9px]">
                {artifacts.length}
              </span>
            </div>

            <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1">
              {artifacts.map((file, idx) => {
                const isSelected = selectedFileIndex === idx;
                return (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFileIndex(idx)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-[#0f172a] text-white border-slate-700 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
                      <FileCode className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                      <span className="truncate">{file.path}</span>
                    </div>
                    <p className={`text-[10px] mt-0.5 line-clamp-2 ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                      {file.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Code Viewer */}
        <div className="lg:col-span-8">
          {currentFile ? (
            <div className="bg-slate-950 rounded-lg shadow-xs border border-slate-800 overflow-hidden">
              {/* Header Bar */}
              <div className="bg-slate-900/90 px-3.5 py-2 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-mono text-xs font-bold text-slate-300 ml-1.5">{currentFile.path}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleDownload}
                    title="Descargar archivo"
                    className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleCopy}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-semibold flex items-center gap-1 transition"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Code Pre/Content */}
              <div className="p-3 max-h-[620px] overflow-auto font-mono text-[11px] text-slate-200 leading-relaxed scrollbar-thin">
                <pre>
                  <code>{currentFile.content}</code>
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400 text-xs">Cargando código...</div>
          )}
        </div>
      </div>
    </div>
  );
}
