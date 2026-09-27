import React from 'react';
import { User, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import { usePreferences } from '../context/PreferencesContext';
import { PWAInstallButton } from './PWAInstallButton';
import {
  Globe2,
  Navigation,
  Layers,
  FolderKanban,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  LogIn,
  LogOut,
  X,
  Languages,
} from 'lucide-react';

interface SidebarProps {
  activeTab: 'map' | 'capture' | 'list' | 'categories' | 'assistant' | 'settings';
  setActiveTab: (tab: 'map' | 'capture' | 'list' | 'categories' | 'assistant' | 'settings') => void;
  user: User | null;
  locationsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  user,
  locationsCount,
}) => {
  const {
    theme,
    setTheme,
    accentConfig,
    lang,
    setLang,
    t,
    sidebarCollapsed,
    toggleSidebar,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = usePreferences();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request'
      ) {
        // User closed or cancelled the popup - expected user action
        return;
      }
      console.warn('Info connexion Google:', error?.message || error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  };

  const navItems = [
    {
      id: 'map' as const,
      label: t('nav.map'),
      desc: t('nav.mapDesc'),
      icon: Globe2,
      badge: locationsCount > 0 ? locationsCount : null,
    },
    {
      id: 'capture' as const,
      label: t('nav.capture'),
      desc: t('nav.captureDesc'),
      icon: Navigation,
      pulse: true,
    },
    {
      id: 'list' as const,
      label: t('nav.list'),
      desc: t('nav.listDesc'),
      icon: Layers,
      badge: locationsCount,
    },
    {
      id: 'categories' as const,
      label: t('nav.categories'),
      desc: t('nav.categoriesDesc'),
      icon: FolderKanban,
    },
    {
      id: 'assistant' as const,
      label: t('nav.assistant'),
      desc: t('nav.assistantDesc'),
      icon: Sparkles,
    },
    {
      id: 'settings' as const,
      label: t('nav.settings'),
      desc: t('nav.settingsDesc'),
      icon: Settings,
    },
  ];

  const handleSelectTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Sidebar Header / Brand */}
      <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
        <div
          className="flex items-center gap-3 cursor-pointer select-none overflow-hidden"
          onClick={() => handleSelectTab('map')}
        >
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 shadow-md flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src="/logo-powerful-reach.png"
              alt="CARTO-PR Logo"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 transition-opacity duration-200">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white truncate">
                  CARTO-PR
                </span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider text-white"
                  style={{ backgroundColor: accentConfig.hex }}
                >
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                POWERFUL REACH
              </p>
            </div>
          )}
        </div>

        {/* Toggle Collapse Desktop button */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden md:flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title={sidebarCollapsed ? t('common.expand') : t('common.collapse')}
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-800">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              title={sidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group cursor-pointer relative ${
                isActive
                  ? 'text-white shadow-md font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
              style={{
                backgroundColor: isActive ? accentConfig.hex : undefined,
              }}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white group-hover:bg-slate-200 dark:group-hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${item.pulse && isActive ? 'animate-bounce' : ''}`} />
              </div>

              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <div className="truncate">
                    <span
                      className={`text-xs font-semibold block truncate ${
                        isActive ? 'text-white' : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span
                      className={`text-[10px] block truncate ${
                        isActive ? 'text-white/80' : 'text-slate-500'
                      }`}
                    >
                      {item.desc}
                    </span>
                  </div>

                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        isActive
                          ? 'bg-white text-slate-900'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}

              {/* Active bar indicator when collapsed */}
              {sidebarCollapsed && isActive && (
                <div
                  className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-white"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick Controls Bar: Theme + Language */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40 space-y-2 shrink-0">
        {!sidebarCollapsed ? (
          <div className="flex items-center justify-between gap-2 px-1">
            {/* Quick Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-200/80 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs transition-colors cursor-pointer border border-slate-300 dark:border-transparent"
              title={theme === 'dark' ? t('settings.light') : t('settings.dark')}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[11px] font-medium">{t('settings.light')}</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                  <span className="text-[11px] font-medium">{t('settings.dark')}</span>
                </>
              )}
            </button>

            {/* Quick Language Toggle */}
            <button
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-slate-200/80 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-[11px] font-bold transition-colors cursor-pointer border border-slate-300 dark:border-transparent"
              title="Changer de langue / Switch language"
            >
              <Languages className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              <span>{lang.toUpperCase()}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg bg-slate-200/80 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer border border-slate-300 dark:border-transparent"
              title={theme === 'dark' ? t('settings.light') : t('settings.dark')}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
              )}
            </button>
            <button
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              className="p-2 rounded-lg bg-slate-200/80 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition-colors cursor-pointer border border-slate-300 dark:border-transparent"
              title={lang === 'fr' ? 'Switch to English' : 'Passer en Français'}
            >
              {lang.toUpperCase()}
            </button>
          </div>
        )}

        {/* PWA Install Button */}
        <div className="flex justify-center">
          <PWAInstallButton />
        </div>

        {/* User Profile Card */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60">
          {user ? (
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Utilisateur'}
                    className="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-700 shrink-0"
                  />
                ) : (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0"
                    style={{ backgroundColor: accentConfig.hex }}
                  >
                    {(user.displayName || user.email || 'A')[0].toUpperCase()}
                  </div>
                )}
                {!sidebarCollapsed && (
                  <div className="min-w-0 truncate">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {user.displayName || user.email?.split('@')[0]}
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                      ● {t('common.online')}
                    </p>
                  </div>
                )}
              </div>

              {!sidebarCollapsed && (
                <button
                  onClick={handleSignOut}
                  className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-100 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  title={t('common.logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-semibold transition-all cursor-pointer border border-slate-300 dark:border-slate-700 ${
                sidebarCollapsed ? 'p-2' : ''
              }`}
              title={t('common.login')}
            >
              <LogIn className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
              {!sidebarCollapsed && <span>{t('common.login')}</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden md:block h-screen sticky top-0 shrink-0 z-30 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-20' : 'w-64 lg:w-72'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Overlay + Slide-in) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] h-full z-10 shadow-2xl animate-slide-right">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
