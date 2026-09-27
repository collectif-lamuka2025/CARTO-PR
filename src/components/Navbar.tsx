import React from 'react';
import { User, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import { PWAInstallButton } from './PWAInstallButton';
import {
  MapPin,
  Globe2,
  Navigation,
  FolderKanban,
  Sparkles,
  LogIn,
  LogOut,
  User as UserIcon,
  Layers,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'map' | 'capture' | 'list' | 'categories' | 'assistant';
  setActiveTab: (tab: 'map' | 'capture' | 'list' | 'categories' | 'assistant') => void;
  user: User | null;
  locationsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  locationsCount,
}) => {
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Erreur de connexion Google:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Globe2 className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  CartoPartenaires
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                  Terrain
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Cartographie & repérage GPS haute précision
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'map'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Globe2 className="w-4 h-4" />
              <span>Carte Globale</span>
              {locationsCount > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-blue-400/30 text-white font-bold">
                  {locationsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('capture')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'capture'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Navigation className="w-4 h-4 text-emerald-400" />
              <span>Relevé GPS</span>
            </button>

            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'list'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Partenaires</span>
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'categories'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FolderKanban className="w-4 h-4" />
              <span>Catégories</span>
            </button>

            <button
              onClick={() => setActiveTab('assistant')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'assistant'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>IA Terrain</span>
            </button>
          </nav>

          {/* User Profile / Auth / Install */}
          <div className="flex items-center gap-2 sm:gap-3">
            <PWAInstallButton />
            {user ? (
              <div className="flex items-center gap-2.5 bg-slate-800/80 pl-2 pr-3 py-1.5 rounded-xl border border-slate-700">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Agent'}
                    className="w-7 h-7 rounded-full object-cover border border-blue-400"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                    {user.email ? user.email.slice(0, 2).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-semibold text-slate-200 truncate max-w-[130px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate max-w-[130px]">
                    Agent terrain
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  title="Déconnexion"
                  className="text-slate-400 hover:text-rose-400 p-1 rounded-lg transition-colors ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Connexion Google</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden flex overflow-x-auto gap-1 px-3 py-2 bg-slate-950 border-t border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap ${
            activeTab === 'map' ? 'bg-blue-600 text-white' : 'text-slate-400'
          }`}
        >
          <Globe2 className="w-3.5 h-3.5" />
          <span>Carte ({locationsCount})</span>
        </button>
        <button
          onClick={() => setActiveTab('capture')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap ${
            activeTab === 'capture' ? 'bg-emerald-600 text-white' : 'text-slate-400'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Relever GPS</span>
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap ${
            activeTab === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Liste</span>
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap ${
            activeTab === 'categories' ? 'bg-purple-600 text-white' : 'text-slate-400'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Catégories</span>
        </button>
        <button
          onClick={() => setActiveTab('assistant')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap ${
            activeTab === 'assistant' ? 'bg-amber-600 text-white' : 'text-slate-400'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>IA Terrain</span>
        </button>
      </div>
    </header>
  );
};
