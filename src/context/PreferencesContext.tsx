import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light';
export type AccentColorKey = 'blue' | 'red' | 'green' | 'pink' | 'purple' | 'orange' | 'cyan';
export type Language = 'fr' | 'en';

export interface AccentConfig {
  key: AccentColorKey;
  name: { fr: string; en: string };
  hex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  ringClass: string;
  gradientClass: string;
  lightBgClass: string;
}

export const ACCENT_COLORS: Record<AccentColorKey, AccentConfig> = {
  blue: {
    key: 'blue',
    name: { fr: 'Bleu Royal', en: 'Royal Blue' },
    hex: '#2563eb',
    bgClass: 'bg-blue-600',
    textClass: 'text-blue-500 dark:text-blue-400',
    borderClass: 'border-blue-500',
    ringClass: 'ring-blue-500',
    gradientClass: 'from-blue-600 to-indigo-600',
    lightBgClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  red: {
    key: 'red',
    name: { fr: 'Rouge Écarlate', en: 'Crimson Red' },
    hex: '#dc2626',
    bgClass: 'bg-red-600',
    textClass: 'text-red-500 dark:text-red-400',
    borderClass: 'border-red-500',
    ringClass: 'ring-red-500',
    gradientClass: 'from-red-600 to-rose-600',
    lightBgClass: 'bg-red-500/10 text-red-600 dark:text-red-400',
  },
  green: {
    key: 'green',
    name: { fr: 'Vert Émeraude', en: 'Emerald Green' },
    hex: '#16a34a',
    bgClass: 'bg-emerald-600',
    textClass: 'text-emerald-500 dark:text-emerald-400',
    borderClass: 'border-emerald-500',
    ringClass: 'ring-emerald-500',
    gradientClass: 'from-emerald-600 to-teal-600',
    lightBgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  pink: {
    key: 'pink',
    name: { fr: 'Rose Rubis', en: 'Ruby Pink' },
    hex: '#db2777',
    bgClass: 'bg-pink-600',
    textClass: 'text-pink-500 dark:text-pink-400',
    borderClass: 'border-pink-500',
    ringClass: 'ring-pink-500',
    gradientClass: 'from-pink-600 to-rose-600',
    lightBgClass: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  },
  purple: {
    key: 'purple',
    name: { fr: 'Violet Améthyste', en: 'Amethyst Purple' },
    hex: '#7c3aed',
    bgClass: 'bg-purple-600',
    textClass: 'text-purple-500 dark:text-purple-400',
    borderClass: 'border-purple-500',
    ringClass: 'ring-purple-500',
    gradientClass: 'from-purple-600 to-indigo-600',
    lightBgClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  orange: {
    key: 'orange',
    name: { fr: 'Orange Ambré', en: 'Amber Orange' },
    hex: '#ea580c',
    bgClass: 'bg-orange-600',
    textClass: 'text-orange-500 dark:text-orange-400',
    borderClass: 'border-orange-500',
    ringClass: 'ring-orange-500',
    gradientClass: 'from-orange-600 to-amber-600',
    lightBgClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  },
  cyan: {
    key: 'cyan',
    name: { fr: 'Cyan Fluo', en: 'Electric Cyan' },
    hex: '#0891b2',
    bgClass: 'bg-cyan-600',
    textClass: 'text-cyan-500 dark:text-cyan-400',
    borderClass: 'border-cyan-500',
    ringClass: 'ring-cyan-500',
    gradientClass: 'from-cyan-600 to-blue-600',
    lightBgClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  },
};

const TRANSLATIONS: Record<string, { fr: string; en: string }> = {
  // Navigation
  'nav.map': { fr: 'Carte Globale', en: 'Global Map' },
  'nav.mapDesc': { fr: 'Visualisation & Itinéraires', en: 'Visualization & Routes' },
  'nav.capture': { fr: 'Relevé GPS', en: 'GPS Survey' },
  'nav.captureDesc': { fr: 'Acquisition terrain', en: 'Field Data Capture' },
  'nav.list': { fr: 'Partenaires', en: 'Partners' },
  'nav.listDesc': { fr: 'Répertoire & Itinéraires', en: 'Directory & Routes' },
  'nav.categories': { fr: 'Catégories', en: 'Categories' },
  'nav.categoriesDesc': { fr: 'Gestion des typologies', en: 'Manage Typologies' },
  'nav.assistant': { fr: 'Assistant Terrain', en: 'Field Assistant' },
  'nav.assistantDesc': { fr: 'Aide & diagnostic', en: 'Help & Diagnostics' },
  'nav.settings': { fr: 'Paramètres', en: 'Settings' },
  'nav.settingsDesc': { fr: 'Thème, couleurs & langue', en: 'Theme, colors & lang' },

  // Common UI
  'app.name': { fr: 'CARTO-PR', en: 'CARTO-PR' },
  'app.tagline': { fr: 'Cartographie & Relevé Terrain', en: 'Field Mapping & Survey' },
  'app.agencyTitle': { fr: 'Agence de création', en: 'Creation Agency' },
  'app.agencyName': { fr: 'POWERFUL REACH', en: 'POWERFUL REACH' },
  'app.agencyWhatsApp': { fr: '+242050133271', en: '+242050133271' },
  'app.agencyWebsite': { fr: 'https://powerfulreach.netlify.app/', en: 'https://powerfulreach.netlify.app/' },
  'common.search': { fr: 'Rechercher...', en: 'Search...' },
  'common.save': { fr: 'Enregistrer', en: 'Save' },
  'common.cancel': { fr: 'Annuler', en: 'Cancel' },
  'common.delete': { fr: 'Supprimer', en: 'Delete' },
  'common.edit': { fr: 'Modifier', en: 'Edit' },
  'common.filter': { fr: 'Filtrer', en: 'Filter' },
  'common.all': { fr: 'Tous', en: 'All' },
  'common.close': { fr: 'Fermer', en: 'Close' },
  'common.online': { fr: 'En ligne', en: 'Online' },
  'common.offline': { fr: 'Hors-ligne', en: 'Offline' },
  'common.sync': { fr: 'Synchronisé', en: 'Synchronized' },
  'common.collapse': { fr: 'Réduire', en: 'Collapse' },
  'common.expand': { fr: 'Dérouler', en: 'Expand' },
  'common.options': { fr: 'Options & Filtres', en: 'Options & Filters' },
  'common.recenter': { fr: 'Recentrer', en: 'Recenter' },
  'common.reframe': { fr: 'Recadrer', en: 'Refit view' },
  'common.login': { fr: 'Connexion Google', en: 'Sign in with Google' },
  'common.logout': { fr: 'Déconnexion', en: 'Sign out' },
  'common.guest': { fr: 'Agent Invité', en: 'Guest Agent' },

  // Settings
  'settings.title': { fr: 'Paramètres de l\'application', en: 'Application Settings' },
  'settings.subtitle': {
    fr: 'Personnalisez l\'apparence, la palette de couleurs et la langue de travail',
    en: 'Customize appearance, color palette, and working language',
  },
  'settings.themeSection': { fr: 'Thème d\'Affichage', en: 'Display Theme' },
  'settings.themeDesc': {
    fr: 'Choisissez entre le mode sombre immersif et le mode clair haute visibilité pour le soleil',
    en: 'Choose between immersive dark mode and high-visibility light mode for sunlight',
  },
  'settings.dark': { fr: 'Mode Sombre', en: 'Dark Mode' },
  'settings.darkDesc': { fr: 'Fond sombre, contraste élevé, économie de batterie', en: 'Dark background, high contrast, battery saver' },
  'settings.light': { fr: 'Mode Clair', en: 'Light Mode' },
  'settings.lightDesc': { fr: 'Fond épuré, haute lisibilité en plein soleil', en: 'Clean light background, readable under sunlight' },
  'settings.accentSection': { fr: 'Couleur d\'Accentuation', en: 'Accent Color' },
  'settings.accentDesc': {
    fr: 'Cette teinte sera appliquée aux boutons principaux, repères actifs et éléments interactifs',
    en: 'This shade will be applied to primary buttons, active markers, and interactive controls',
  },
  'settings.langSection': { fr: 'Langue de l\'Interface', en: 'Interface Language' },
  'settings.langDesc': {
    fr: 'Basculez instantanément l\'ensemble de l\'application en Français ou en Anglais',
    en: 'Instantly switch the entire application into French or English',
  },
  'settings.french': { fr: 'Français (FR)', en: 'French (FR)' },
  'settings.english': { fr: 'English (EN)', en: 'English (EN)' },
  'settings.deviceInfo': { fr: 'Informations Appareil & PWA', en: 'Device & PWA Information' },
  'settings.deviceDesc': { fr: 'Statut du stockage hors-ligne, cache et synchronisation', en: 'Offline storage, cache, and sync status' },
  'settings.resetDefaults': { fr: 'Rétablir les valeurs par défaut', en: 'Reset to Defaults' },

  // World Map
  'map.header': { fr: 'Cartographie Globale des Partenaires', en: 'Global Partner Mapping' },
  'map.subtitle': {
    fr: 'Points GPS terrain haute visibilité avec tracé d\'itinéraire en un clic',
    en: 'High-visibility field GPS points with one-click route tracing',
  },
  'map.traceRoute': { fr: 'Tracer l\'itinéraire direct', en: 'Trace direct route' },
  'map.routeTitle': { fr: 'Itinéraire vers', en: 'Route to' },
  'map.departure': { fr: 'Départ : Votre position exacte', en: 'Origin: Your exact position' },
  'map.arrival': { fr: 'Arrivée :', en: 'Destination:' },
  'map.distance': { fr: 'Distance', en: 'Distance' },
  'map.duration': { fr: 'Durée', en: 'Duration' },
  'map.car': { fr: 'Voiture', en: 'Driving' },
  'map.walk': { fr: 'À pied', en: 'Walking' },
  'map.bike': { fr: 'Vélo', en: 'Bicycling' },
  'map.extNav': { fr: 'Guidage GPS externe', en: 'External GPS navigation' },
  'map.filterCategory': { fr: 'Filtrer par catégorie', en: 'Filter by category' },
  'map.allCategories': { fr: 'Toutes les catégories', en: 'All categories' },
  'map.modeRoad': { fr: 'Plan', en: 'Roadmap' },
  'map.modeSat': { fr: 'Satellite', en: 'Satellite' },
  'map.modeHyb': { fr: 'Hybride', en: 'Hybrid' },
  'map.modeTer': { fr: 'Relief', en: 'Terrain' },

  // Capture GPS
  'capture.header': { fr: 'Relevé GPS & Enregistrement Terrain', en: 'GPS Survey & Field Recording' },
  'capture.subtitle': {
    fr: 'Acquisition précise des coordonnées satellites et saisie des fiches partenaires',
    en: 'Accurate satellite coordinate capture and partner data entry',
  },
  'capture.recordBtn': { fr: 'Enregistrer ce Point Terrain', en: 'Record this Field Point' },
  'capture.refreshBtn': { fr: 'Actualiser GPS', en: 'Refresh GPS' },
  'capture.testBtn': { fr: 'Position Test', en: 'Test Position' },
  'capture.telemetry': { fr: 'Télémétrie Satellite en direct', en: 'Live Satellite Telemetry' },
  'capture.lat': { fr: 'Latitude', en: 'Latitude' },
  'capture.lng': { fr: 'Longitude', en: 'Longitude' },
  'capture.alt': { fr: 'Altitude', en: 'Altitude' },
  'capture.acc': { fr: 'Précision', en: 'Accuracy' },

  // Partners list
  'list.header': { fr: 'Répertoire des Partenaires', en: 'Partners Directory' },
  'list.subtitle': {
    fr: 'Liste des points enregistrés, consultation des fiches et lancement d\'itinéraires',
    en: 'List of recorded points, record viewing, and route launching',
  },
  'list.newSurvey': { fr: 'Nouveau Relevé', en: 'New Survey' },
  'list.exportCsv': { fr: 'Exporter CSV', en: 'Export CSV' },
  'list.locateOnMap': { fr: 'Voir sur Carte', en: 'View on Map' },
  'list.delete': { fr: 'Supprimer', en: 'Delete' },
  'list.noResults': { fr: 'Aucun partenaire trouvé', en: 'No partners found' },
  'list.changeCategory': { fr: 'Changer la catégorie', en: 'Change category' },
  'list.categoryChanged': { fr: 'Catégorie modifiée avec succès', en: 'Category updated successfully' },
  'list.coordsPreserved': {
    fr: 'Coordonnées GPS et informations du lieu préservées à 100%',
    en: 'GPS coordinates and place information 100% preserved',
  },
  'list.selectNewCategory': { fr: 'Attribuer une autre catégorie', en: 'Assign another category' },
  'list.currentCategory': { fr: 'Catégorie actuelle', en: 'Current category' },

  // Categories
  'cat.header': { fr: 'Gestion des Catégories', en: 'Categories Management' },
  'cat.subtitle': {
    fr: 'Personnalisez les couleurs et typologies pour différencier les partenaires sur la carte',
    en: 'Customize colors and typologies to differentiate partners on the map',
  },
  'cat.newBtn': { fr: 'Créer une Catégorie', en: 'Create Category' },
  'cat.name': { fr: 'Nom de la Catégorie', en: 'Category Name' },
  'cat.color': { fr: 'Couleur Distinctive', en: 'Distinctive Color' },
};

interface PreferencesContextType {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  accent: AccentColorKey;
  setAccent: (a: AccentColorKey) => void;
  accentConfig: AccentConfig;
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('carto_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark'; // Default dark field mode
  });

  // Accent color state
  const [accent, setAccentState] = useState<AccentColorKey>(() => {
    const saved = localStorage.getItem('carto_accent');
    if (saved && saved in ACCENT_COLORS) return saved as AccentColorKey;
    return 'blue';
  });

  // Language state
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('carto_lang');
    if (saved === 'en' || saved === 'fr') return saved;
    return 'fr'; // Default French
  });

  // Sidebar collapsed state (desktop)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('carto_sidebar_collapsed');
    return saved === 'true';
  });

  // Mobile drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync theme with DOM and localStorage
  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('carto_theme', newTheme);
  };

  const setAccent = (newAccent: AccentColorKey) => {
    setAccentState(newAccent);
    localStorage.setItem('carto_accent', newAccent);
  };

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('carto_lang', newLang);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('carto_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Translation helper
  const t = (key: string): string => {
    const entry = TRANSLATIONS[key];
    if (!entry) return key;
    return entry[lang] || entry.fr || key;
  };

  // Apply dark/light class to root element and body
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
      if (body) {
        body.classList.add('dark');
        body.classList.remove('light');
      }
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
      if (body) {
        body.classList.add('light');
        body.classList.remove('dark');
      }
    }
  }, [theme]);

  // Apply dynamic CSS variable for accent color
  useEffect(() => {
    const conf = ACCENT_COLORS[accent] || ACCENT_COLORS.blue;
    document.documentElement.style.setProperty('--primary-accent', conf.hex);
  }, [accent]);

  const accentConfig = ACCENT_COLORS[accent] || ACCENT_COLORS.blue;

  return (
    <PreferencesContext.Provider
      value={{
        theme,
        setTheme,
        accent,
        setAccent,
        accentConfig,
        lang,
        setLang,
        t,
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
        mobileMenuOpen,
        setMobileMenuOpen,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};
