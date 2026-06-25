import React, { useState, useMemo } from 'react';
import { GeneratedFile } from '../types';
import { CustomSyntaxHighlighter } from './CustomSyntaxHighlighter';
import { Copy, Check, FileCode, Search, Download, HelpCircle } from 'lucide-react';

interface CodeViewerProps {
  files: GeneratedFile[];
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ files }) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [copiedIndex, setCopiedIndex] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activeFile = files[activeTab] || files[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopiedIndex(true);
      setTimeout(() => setCopiedIndex(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const handleDownloadAll = () => {
    // Generate an aggregate setup script or download the individual file
    const element = document.createElement('a');
    const file = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = activeFile.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Filtered/Highlighted search lines indicator
  const matchCount = useMemo(() => {
    if (!searchQuery) return 0;
    const lowerQuery = searchQuery.toLowerCase();
    const lines = activeFile.content.split('\n');
    return lines.filter(line => line.toLowerCase().includes(lowerQuery)).length;
  }, [searchQuery, activeFile]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-full" id="code-viewer">
      {/* File Tab List */}
      <div className="flex border-b border-zinc-800 bg-zinc-950/60 overflow-x-auto scrollbar-none">
        {files.map((file, idx) => (
          <button
            key={idx}
            onClick={() => {
              setActiveTab(idx);
              setSearchQuery('');
            }}
            className={`px-4 py-3.5 text-xs font-mono border-r border-zinc-850 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === idx
                ? 'bg-zinc-900 text-emerald-400 font-semibold border-b-2 border-b-emerald-500'
                : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
            }`}
          >
            <FileCode className={`w-3.5 h-3.5 ${activeTab === idx ? 'text-emerald-400' : 'text-zinc-500'}`} />
            {file.name}
          </button>
        ))}
      </div>

      {/* Top action bar */}
      <div className="p-3 bg-zinc-900 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-400 font-mono text-[10px]">TARGET PATH:</span>
          <code className="bg-zinc-950 px-2 py-1 rounded text-emerald-400 font-mono text-[11px] select-all break-all border border-zinc-850">
            {activeFile.path}
          </code>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search code..."
              className="w-40 sm:w-48 bg-zinc-950 text-zinc-200 pl-8 pr-3 py-1.5 rounded border border-zinc-800 text-[11px] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2" />
            {searchQuery && (
              <span className="absolute right-2 top-2 text-[9px] font-mono bg-zinc-800 px-1 py-0.5 rounded text-zinc-400">
                {matchCount} matches
              </span>
            )}
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 rounded font-medium border border-zinc-700 transition-colors"
          >
            {copiedIndex ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-300" />
                <span className="text-[11px]">Copy</span>
              </>
            )}
          </button>

          {/* Single Download */}
          <button
            onClick={handleDownloadAll}
            title="Download this file"
            className="flex items-center justify-center p-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 rounded border border-zinc-850 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Description Header */}
      <div className="px-4 py-2.5 bg-zinc-950/30 border-b border-zinc-850 flex items-start gap-2 text-zinc-400">
        <HelpCircle className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
        <p className="text-[11px] leading-relaxed">
          {activeFile.description}
        </p>
      </div>

      {/* Code Area */}
      <div className="flex-1 bg-zinc-950/90 overflow-auto max-h-[500px] sm:max-h-none h-full py-4 text-zinc-300 relative">
        <CustomSyntaxHighlighter code={activeFile.content} language={activeFile.language} />
      </div>
    </div>
  );
};
