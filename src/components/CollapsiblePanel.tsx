import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsiblePanelProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  defaultExpanded?: boolean;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  subtitle,
  icon,
  badge,
  defaultExpanded = true,
  isExpanded: controlledExpanded,
  onToggle,
  children,
  action,
  className = '',
  headerClassName = '',
  contentClassName = '',
}) => {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    const next = !isExpanded;
    if (controlledExpanded === undefined) {
      setInternalExpanded(next);
    }
    onToggle?.(next);
  };

  return (
    <div
      className={`rounded-2xl border transition-all shadow-sm ${
        isExpanded
          ? 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800'
          : 'bg-slate-50/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
      } ${className}`}
    >
      {/* Header bar */}
      <div
        className={`flex items-center justify-between p-3 sm:p-4 select-none cursor-pointer ${headerClassName}`}
        onClick={handleToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center shrink-0 text-slate-700 dark:text-slate-300">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                {title}
              </h3>
              {badge}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
          {action}
          <button
            type="button"
            onClick={handleToggle}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-transform cursor-pointer"
            aria-label={isExpanded ? 'Réduire' : 'Dérouler'}
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Collapsible Content Body */}
      {isExpanded && (
        <div className={`p-4 pt-1 border-t border-slate-200 dark:border-slate-800/60 animate-fade-in ${contentClassName}`}>
          {children}
        </div>
      )}
    </div>
  );
};
