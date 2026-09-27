import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  Copy,
  MapPin,
  Compass,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface FormattedAIResponseProps {
  content: string;
  groundingMetadata?: any;
}

export const FormattedAIResponse: React.FC<FormattedAIResponseProps> = ({
  content,
  groundingMetadata,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // Strip raw markdown for clean clipboard copy
    const plainText = content
      .replace(/###+\s*/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/---/g, '')
      .trim();

    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Helper to parse bold and clean formatting inside lines
  const renderFormattedLine = (line: string) => {
    // Remove grounding tags like [1] or [cite: ...]
    const sanitized = line.replace(/\[\d+\]/g, '').replace(/\[cite:[^\]]+\]/g, '');

    // Split by bold (**text**)
    const parts = sanitized.split(/(\*\*[^*]+\*\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        return (
          <strong
            key={index}
            className="font-bold text-slate-900 dark:text-amber-100"
          >
            {inner}
          </strong>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Parse lines into structured elements
  const renderStructuredContent = () => {
    const rawLines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

    const flushList = () => {
      if (!currentList) return;
      if (currentList.type === 'ul') {
        elements.push(
          <ul key={`list-${elements.length}`} className="my-3 space-y-2 pl-1">
            {currentList.items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <div className="flex-1 leading-relaxed">{renderFormattedLine(item)}</div>
              </li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`list-${elements.length}`} className="my-3 space-y-2.5 pl-1">
            {currentList.items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
                <span className="mt-0.5 flex items-center justify-center w-5 h-5 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-[11px] shrink-0 border border-amber-500/30">
                  {idx + 1}
                </span>
                <div className="flex-1 leading-relaxed">{renderFormattedLine(item)}</div>
              </li>
            ))}
          </ol>
        );
      }
      currentList = null;
    };

    rawLines.forEach((rawLine, i) => {
      const line = rawLine.trim();

      if (!line) {
        flushList();
        return;
      }

      // Horizontal rules
      if (line === '---' || line === '***' || line === '___') {
        flushList();
        elements.push(
          <hr key={`hr-${i}`} className="my-4 border-slate-200 dark:border-slate-800" />
        );
        return;
      }

      // Headers (### or ####)
      if (line.startsWith('###') || line.startsWith('##') || line.startsWith('#')) {
        flushList();
        const headerText = line.replace(/^#+\s*/, '');
        elements.push(
          <div
            key={`h-${i}`}
            className="mt-4 mb-2 flex items-center gap-2 pb-1.5 border-b border-slate-200/80 dark:border-slate-800"
          >
            <Compass className="w-4 h-4 text-amber-500 shrink-0" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              {headerText}
            </h3>
          </div>
        );
        return;
      }

      // Unordered list item (*, -, •)
      if (/^[-*•]\s+/.test(line)) {
        const itemText = line.replace(/^[-*•]\s+/, '');
        if (currentList && currentList.type === 'ul') {
          currentList.items.push(itemText);
        } else {
          flushList();
          currentList = { type: 'ul', items: [itemText] };
        }
        return;
      }

      // Ordered list item (1., 2., etc.)
      if (/^\d+[.)]\s+/.test(line)) {
        const itemText = line.replace(/^\d+[.)]\s+/, '');
        if (currentList && currentList.type === 'ol') {
          currentList.items.push(itemText);
        } else {
          flushList();
          currentList = { type: 'ol', items: [itemText] };
        }
        return;
      }

      // Callouts / Note lines
      if (line.toLowerCase().startsWith('*(note') || line.toLowerCase().startsWith('(note')) {
        flushList();
        const noteText = line.replace(/^\*?\s*\(|\)\s*\*?$/g, '');
        elements.push(
          <div
            key={`note-${i}`}
            className="my-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2 italic"
          >
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>{renderFormattedLine(noteText)}</span>
          </div>
        );
        return;
      }

      // Regular Paragraph
      flushList();
      elements.push(
        <p
          key={`p-${i}`}
          className="my-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
        >
          {renderFormattedLine(line)}
        </p>
      );
    });

    flushList();
    return elements;
  };

  const mapSources = groundingMetadata?.groundingChunks?.filter(
    (c: any) => c.maps?.title || c.web?.title
  );

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Analyse Terrain Structurée
            </h4>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              Guidage opérationnel & repérage GPS
            </span>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
          title="Copier le compte-rendu"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">Copié</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copier</span>
            </>
          )}
        </button>
      </div>

      {/* Styled Content */}
      <div className="bg-slate-50/50 dark:bg-slate-950/40 rounded-xl p-4 sm:p-5 border border-slate-200/60 dark:border-slate-800/60">
        {renderStructuredContent()}
      </div>

      {/* Verified Google Maps Grounding Sources */}
      {mapSources && mapSources.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
            <MapPin className="w-3.5 h-3.5 text-blue-500" />
            <span>Repères & Lieux Google Maps vérifiés :</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {mapSources.map((chunk: any, idx: number) => {
              const title = chunk.maps?.title || chunk.web?.title || 'Lieu répertorié';
              const uri = chunk.maps?.placeAnswerUri || chunk.web?.uri;

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300"
                >
                  <span className="truncate font-medium">{title}</span>
                  {uri && (
                    <a
                      href={uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-500 hover:text-blue-600 dark:text-cyan-400 shrink-0 flex items-center gap-1"
                    >
                      <span>Voir</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
