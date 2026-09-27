import React, { useState } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import { usePreferences } from '../context/PreferencesContext';
import {
  Globe2,
  Navigation,
  ShieldCheck,
  Lock,
  Mail,
  Key,
  LogIn,
  UserPlus,
  Sparkles,
  WifiOff,
  Sun,
  Moon,
  Languages,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Layers,
  Compass,
} from 'lucide-react';

export const AuthGateView: React.FC = () => {
  const { theme, setTheme, lang, setLang, t, accentConfig } = usePreferences();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        // User closed or dismissed the popup
        setErrorMsg('Connexion Google annulée (fenêtre fermée). Vous pouvez réessayer ou vous connecter par email.');
      } else if (err?.code === 'auth/popup-blocked') {
        setErrorMsg('La fenêtre pop-up a été bloquée par votre navigateur. Veuillez autoriser les pop-ups ou utiliser la connexion par email.');
      } else {
        console.warn('Info Google Auth:', err?.message || err);
        setErrorMsg('Impossible de finaliser la connexion Google. Vous pouvez utiliser la connexion par email ci-dessous.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Veuillez renseigner votre email et mot de passe.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      if (authMode === 'signup') {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName.trim() && userCred.user) {
          await updateProfile(userCred.user, { displayName: displayName.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.warn('Email Auth status:', err?.code || err?.message);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('Identifiants incorrects. Vérifiez votre email et mot de passe.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('Cet email est déjà associé à un compte. Veuillez vous connecter.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('Le mot de passe doit contenir au moins 6 caractères.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg('Format d’adresse email invalide.');
      } else {
        setErrorMsg(err.message || 'Erreur lors de l’authentification.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const userCred = await signInAnonymously(auth);
      if (userCred.user) {
        await updateProfile(userCred.user, { displayName: 'Agent Terrain Démo' });
      }
    } catch (err: any) {
      console.warn('Demo Auth status:', err?.code || err?.message);
      setErrorMsg('Impossible d’ouvrir la session invité.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white transition-colors antialiased">
      {/* Top Header Bar */}
      <header className="h-16 px-4 sm:px-8 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 shadow-md flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src="/logo-powerful-reach.png"
              alt="CARTO-PR Logo"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white block leading-tight">
                CARTO-PR
              </span>
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider text-white"
                style={{ backgroundColor: accentConfig.hex }}
              >
                PRO
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
              Cartographie Terrain • POWERFUL REACH
            </span>
          </div>
        </div>

        {/* Quick theme and language toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-colors cursor-pointer"
            title="Changer de langue"
          >
            <Languages className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
            <span>{lang.toUpperCase()}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
        {/* Left Side: Presentation and Feature Highlights */}
        <div className="flex-1 space-y-6 max-w-xl text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Accès sécurisé & données isolées par agent</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Cartographie terrain & Relevé GPS des partenaires
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Connectez-vous pour accéder à votre espace personnel. Chaque agent dispose d'une partition
            sécurisée et confidentielle pour enregistrer, consulter et gérer ses propres coordonnées GPS
            et typologies de partenaires.
          </p>

          {/* 3 Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-left">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 font-bold">
                <Navigation className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Relevé GPS Précis</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Acquisition en direct avec coordonnées WGS84, altitude et précision.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2 font-bold">
                <WifiOff className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">100% Hors-Ligne</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Stockage local garanti et synchronisation automatique au retour du réseau.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2 font-bold">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Données Privées</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Vous seul accédez et visualisez vos points enregistrés sur la carte.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Authentication Box */}
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl relative">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {authMode === 'signin' ? 'Connexion à votre compte' : 'Créer un compte Agent'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {authMode === 'signin'
                ? 'Identifiez-vous pour ouvrir votre répertoire de partenaires'
                : 'Créez votre accès agent pour commencer vos relevés'}
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Google One-Click Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-900 dark:text-white font-semibold text-xs sm:text-sm border border-slate-300 dark:border-slate-700 transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continuer avec Google</span>
          </button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400">
              <span className="bg-white dark:bg-slate-900 px-3">Ou avec email</span>
            </div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nom de l'agent
                </label>
                <input
                  type="text"
                  placeholder="ex: Jean Mukendi"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Adresse email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="agent@domaine.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mot de passe
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-white text-xs sm:text-sm font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              style={{ backgroundColor: accentConfig.hex }}
            >
              {loading ? (
                <span>Vérification...</span>
              ) : authMode === 'signin' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Se connecter</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Créer mon compte</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle between sign in and sign up */}
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-center flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              {authMode === 'signin' ? 'Pas encore de compte ?' : 'Déjà un compte ?'}
            </span>
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                setErrorMsg(null);
              }}
              className="font-bold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
            >
              {authMode === 'signin' ? 'Créer un compte' : 'Se connecter'}
            </button>
          </div>

          {/* Optional Demo / Test mode */}
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 text-center">
            <button
              type="button"
              onClick={handleDemoSignIn}
              disabled={loading}
              className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Tester en tant qu’Agent Démo Invité</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-4 text-center text-xs text-slate-500 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800/80">
        CartoPartenaires · Solution cartographique et relevé GPS terrain professionnel · Accès sécurisé
      </footer>
    </div>
  );
};
