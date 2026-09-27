import React from 'react';
import { usePreferences, ACCENT_COLORS, AccentColorKey } from '../context/PreferencesContext';
import { CollapsiblePanel } from './CollapsiblePanel';
import {
  Sun,
  Moon,
  Palette,
  Languages,
  RotateCcw,
  Check,
  ShieldCheck,
  Sparkles,
  Layers,
  MapPin,
  Route,
  Info,
  Building2,
  MessageCircle,
  ExternalLink,
  Phone,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    theme,
    setTheme,
    accent,
    setAccent,
    accentConfig,
    lang,
    setLang,
    t,
  } = usePreferences();

  const handleResetDefaults = () => {
    setTheme('dark');
    setAccent('blue');
    setLang('fr');
  };

  const accentKeys = Object.keys(ACCENT_COLORS) as AccentColorKey[];

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 overflow-y-auto transition-colors">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <span
                className="p-2 rounded-xl text-white shadow-lg"
                style={{ backgroundColor: accentConfig.hex }}
              >
                <Palette className="w-5 h-5" />
              </span>
              <span>{t('settings.title')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              {t('settings.subtitle')}
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="self-start sm:self-auto flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-all cursor-pointer shadow-xs"
            title={t('settings.resetDefaults')}
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>{t('settings.resetDefaults')}</span>
          </button>
        </div>

        {/* 1. Theme Selection (Collapsible) */}
        <CollapsiblePanel
          title={t('settings.themeSection')}
          subtitle={t('settings.themeDesc')}
          icon={<Sun className="w-4 h-4 text-amber-500" />}
          defaultExpanded={true}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {/* Dark Mode Card */}
            <div
              onClick={() => setTheme('dark')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none ${
                theme === 'dark'
                  ? 'bg-slate-900 text-white shadow-xl'
                  : 'bg-slate-100 dark:bg-slate-900/40 border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 opacity-80 hover:opacity-100'
              }`}
              style={{
                borderColor: theme === 'dark' ? accentConfig.hex : undefined,
              }}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400">
                      <Moon className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {t('settings.dark')}
                    </span>
                  </div>
                  {theme === 'dark' && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: accentConfig.hex }}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  {t('settings.darkDesc')}
                </p>
              </div>

              {/* Mini Preview Mock */}
              <div className="mt-4 p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-800" />
                <div className="h-2 w-16 bg-slate-700 rounded-sm" />
                <div
                  className="h-2 w-8 rounded-sm ml-auto"
                  style={{ backgroundColor: accentConfig.hex }}
                />
              </div>
            </div>

            {/* Light Mode Card */}
            <div
              onClick={() => setTheme('light')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none ${
                theme === 'light'
                  ? 'bg-white text-slate-900 shadow-xl'
                  : 'bg-slate-100 dark:bg-slate-900/40 border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 opacity-80 hover:opacity-100'
              }`}
              style={{
                borderColor: theme === 'light' ? accentConfig.hex : undefined,
              }}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-500">
                      <Sun className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {t('settings.light')}
                    </span>
                  </div>
                  {theme === 'light' && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: accentConfig.hex }}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  {t('settings.lightDesc')}
                </p>
              </div>

              {/* Mini Preview Mock */}
              <div className="mt-4 p-2.5 rounded-lg bg-slate-100 border border-slate-200 flex items-center gap-2 text-slate-800">
                <div className="w-3 h-3 rounded-full bg-slate-300" />
                <div className="h-2 w-16 bg-slate-300 rounded-sm" />
                <div
                  className="h-2 w-8 rounded-sm ml-auto"
                  style={{ backgroundColor: accentConfig.hex }}
                />
              </div>
            </div>
          </div>
        </CollapsiblePanel>

        {/* 2. Accent Color Palette (Collapsible) */}
        <CollapsiblePanel
          title={t('settings.accentSection')}
          subtitle={t('settings.accentDesc')}
          icon={<Palette className="w-4 h-4 text-blue-600 dark:text-cyan-400" />}
          defaultExpanded={true}
          badge={
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: accentConfig.hex }}
            >
              {accentConfig.name[lang]}
            </span>
          }
        >
          <div className="mt-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {accentKeys.map((key) => {
                const conf = ACCENT_COLORS[key];
                const isSelected = accent === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAccent(key)}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition-all cursor-pointer select-none relative ${
                      isSelected
                        ? 'bg-white dark:bg-slate-800/90 border-slate-400 shadow-md ring-2'
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                    style={{
                      borderColor: isSelected ? conf.hex : undefined,
                      boxShadow: isSelected ? `0 0 0 2px ${conf.hex}80` : undefined,
                    }}
                  >
                    {/* Color Swatch Circle */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md transition-transform transform group-hover:scale-105"
                      style={{ backgroundColor: conf.hex }}
                    >
                      {isSelected && <Check className="w-5 h-5 stroke-[3]" />}
                    </div>

                    <div className="w-full truncate">
                      <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                        {conf.name[lang]}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        {conf.hex}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Live Interactive UI Preview with selected accent */}
            <div className="mt-5 p-4 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-3">
                Aperçu dynamique de la couleur d'accentuation :
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-2"
                  style={{ backgroundColor: accentConfig.hex }}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Bouton Primaire</span>
                </button>

                <button
                  type="button"
                  className="px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer flex items-center gap-2"
                  style={{
                    borderColor: accentConfig.hex,
                    color: accentConfig.hex,
                    backgroundColor: `${accentConfig.hex}15`,
                  }}
                >
                  <Route className="w-3.5 h-3.5" />
                  <span>Bouton Itinéraire</span>
                </button>

                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: `${accentConfig.hex}22`,
                    color: accentConfig.hex,
                    border: `1px solid ${accentConfig.hex}44`,
                  }}
                >
                  ● Badge Actif
                </span>
              </div>
            </div>
          </div>
        </CollapsiblePanel>

        {/* 3. Automatic Language Translation (Collapsible) */}
        <CollapsiblePanel
          title={t('settings.langSection')}
          subtitle={t('settings.langDesc')}
          icon={<Languages className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          defaultExpanded={true}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {/* Français */}
            <button
              type="button"
              onClick={() => setLang('fr')}
              className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between text-left cursor-pointer select-none ${
                lang === 'fr'
                  ? 'bg-white dark:bg-slate-900 border-opacity-100 shadow-md'
                  : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 opacity-80 hover:opacity-100'
              }`}
              style={{
                borderColor: lang === 'fr' ? accentConfig.hex : undefined,
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🇫🇷</span>
                <div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white block">
                    {t('settings.french')}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Application traduite intégralement en Français
                  </span>
                </div>
              </div>
              {lang === 'fr' && (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white"
                  style={{ backgroundColor: accentConfig.hex }}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </button>

            {/* English */}
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between text-left cursor-pointer select-none ${
                lang === 'en'
                  ? 'bg-white dark:bg-slate-900 border-opacity-100 shadow-md'
                  : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 opacity-80 hover:opacity-100'
              }`}
              style={{
                borderColor: lang === 'en' ? accentConfig.hex : undefined,
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🇬🇧</span>
                <div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white block">
                    {t('settings.english')}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Entire interface translated into English
                  </span>
                </div>
              </div>
              {lang === 'en' && (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white"
                  style={{ backgroundColor: accentConfig.hex }}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </button>
          </div>
        </CollapsiblePanel>

        {/* 4. Agence de Création - POWERFUL REACH */}
        <CollapsiblePanel
          title="Agence de création : POWERFUL REACH"
          subtitle="Développement applicatif sur-mesure & Solutions de cartographie terrain"
          icon={<Building2 className="w-4 h-4 text-blue-600 dark:text-cyan-400" />}
          defaultExpanded={true}
        >
          <div className="mt-3 p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              {/* Logo Emblem */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 shadow-lg flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src="/logo-powerful-reach.png"
                  alt="POWERFUL REACH - CARTO-PR Logo"
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>

              {/* Agency Details */}
              <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    POWERFUL REACH
                  </h4>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white uppercase tracking-wider"
                    style={{ backgroundColor: accentConfig.hex }}
                  >
                    Développeur Officiel
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Concepteur et intégrateur de l'application <strong>CARTO-PR</strong>. Spécialiste des systèmes d'information géographiques (SIG), du repérage d'équipes de terrain et du développement web & mobile haute performance.
                </p>
              </div>
            </div>

            {/* Direct Contact Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              {/* WhatsApp Button */}
              <a
                href="https://wa.me/242050133271"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center sm:justify-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 transition-all font-semibold text-xs group cursor-pointer shadow-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div className="text-left min-w-0">
                  <span className="block text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    WhatsApp Direct
                  </span>
                  <span className="block font-bold text-xs truncate">
                    +242 05 013 3271
                  </span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 ml-auto text-emerald-500 opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>

              {/* Website Link */}
              <a
                href="https://powerfulreach.netlify.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center sm:justify-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200 transition-all font-semibold text-xs group cursor-pointer shadow-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <ExternalLink className="w-4 h-4" />
                </div>
                <div className="text-left min-w-0">
                  <span className="block text-[11px] text-blue-600 dark:text-cyan-400 font-medium">
                    Site Web Officiel
                  </span>
                  <span className="block font-bold text-xs truncate">
                    powerfulreach.netlify.app
                  </span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 ml-auto text-blue-500 opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </div>
        </CollapsiblePanel>
      </div>
    </div>
  );
};
