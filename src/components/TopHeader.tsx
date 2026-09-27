import React from 'react';
import { Menu, Wifi, WifiOff, Radio, Sparkles } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { GPSState } from '../types';

interface TopHeaderProps {
  activeTab: 'map' | 'capture' | 'list' | 'categories' | 'assistant' | 'settings';
  gps?: GPSState;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ activeTab, gps }) => {
  const { t, setMobileMenuOpen, accentConfig } = usePreferences();
  const isOnline = useOnlineStatus();

  const getPageInfo = () => {
    switch (activeTab) {
      case 'map':
        return { title: t('nav.map'), desc: t('map.subtitle') };
      case 'capture':
        return { title: t('nav.capture'), desc: t('capture.subtitle') };
      case 'list':
        return { title: t('nav.list'), desc: t('list.subtitle') };
      case 'categories':
        return { title: t('nav.categories'), desc: t('cat.subtitle') };
      case 'assistant':
        return { title: t('nav.assistant'), desc: t('nav.assistantDesc') };
      case 'settings':
        return { title: t('nav.settings'), desc: t('settings.subtitle') };
      default:
        return { title: t('app.name'), desc: t('app.tagline') };
    }
  };

  const info = getPageInfo();

  return (
    <header className="h-14 sm:h-16 px-4 sm:px-6 bg-white/95 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 z-20 backdrop-blur-md transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Hamburger Menu Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Title and subtitle */}
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate flex items-center gap-2">
            <span>{info.title}</span>
            <span
              className="w-2 h-2 rounded-full inline-block shrink-0"
              style={{ backgroundColor: accentConfig.hex }}
            />
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block truncate">
            {info.desc}
          </p>
        </div>
      </div>

      {/* Right System Indicators */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* GPS satellite lock badge */}
        {gps?.latitude !== null && gps?.latitude !== undefined && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-mono">
            <Radio className="w-3 h-3 text-emerald-500 dark:text-emerald-400 animate-pulse" />
            <span className="hidden sm:inline text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
              GPS FIX
            </span>
            {gps.accuracy && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">±{gps.accuracy}m</span>
            )}
          </div>
        )}

        {/* Online / Offline status */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isOnline
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
              : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400'
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
              <span className="hidden sm:inline text-[11px]">{t('common.online')}</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-amber-500 dark:text-amber-400" />
              <span className="hidden sm:inline text-[11px]">{t('common.offline')}</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
