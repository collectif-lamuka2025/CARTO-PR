import React, { useState, useMemo } from 'react';
import { Category, PartnerLocation } from '../types';
import { deletePartnerLocation, updatePartnerLocationCategory } from '../services/locationService';
import { usePreferences } from '../context/PreferencesContext';
import {
  Search,
  Filter,
  Download,
  Trash2,
  ExternalLink,
  MapPin,
  Phone,
  Navigation,
  User,
  Calendar,
  Layers,
  FileSpreadsheet,
  Route,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Tag,
  Check,
  CheckCircle2,
  X,
  ShieldCheck,
  Edit2,
} from 'lucide-react';

interface LocationsListViewProps {
  locations: PartnerLocation[];
  categories: Category[];
  onSelectOnMap: (loc: PartnerLocation) => void;
  onTraceRoute: (loc: PartnerLocation) => void;
}

export const LocationsListView: React.FC<LocationsListViewProps> = ({
  locations,
  categories,
  onSelectOnMap,
  onTraceRoute,
}) => {
  const { t, accentConfig } = usePreferences();
  const [search, setSearch] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  // Category Change Modal state
  const [categoryModalLocation, setCategoryModalLocation] = useState<PartnerLocation | null>(null);
  const [selectedNewCategoryId, setSelectedNewCategoryId] = useState<string>('');
  const [categoryModalSearch, setCategoryModalSearch] = useState<string>('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    title: string;
    subtitle?: string;
    color?: string;
  } | null>(null);

  const handleOpenCategoryModal = (loc: PartnerLocation) => {
    setCategoryModalLocation(loc);
    setSelectedNewCategoryId(loc.categoryId);
    setCategoryModalSearch('');
  };

  const handleCloseCategoryModal = () => {
    if (isSavingCategory) return;
    setCategoryModalLocation(null);
    setSelectedNewCategoryId('');
    setCategoryModalSearch('');
  };

  const handleSaveCategoryChange = async () => {
    if (!categoryModalLocation || !selectedNewCategoryId) return;
    const targetCategory = categories.find((c) => c.id === selectedNewCategoryId);
    if (!targetCategory) return;

    if (targetCategory.id === categoryModalLocation.categoryId) {
      handleCloseCategoryModal();
      return;
    }

    try {
      setIsSavingCategory(true);
      await updatePartnerLocationCategory(categoryModalLocation, targetCategory);
      setToastMessage({
        title: `Catégorie modifiée : « ${targetCategory.name} »`,
        subtitle: `Le partenaire « ${categoryModalLocation.name} » est maintenant classé dans « ${targetCategory.name} ». Ses coordonnées GPS (${categoryModalLocation.latitude.toFixed(5)}, ${categoryModalLocation.longitude.toFixed(5)}) et toutes ses informations sont préservées.`,
        color: targetCategory.color,
      });
      setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      handleCloseCategoryModal();
    } catch (err) {
      console.error('Erreur mise à jour catégorie:', err);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const filtered = useMemo(() => {
    return locations.filter((loc) => {
      const matchCat = selectedCatId === 'all' || loc.categoryId === selectedCatId;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        loc.name.toLowerCase().includes(q) ||
        (loc.partnerName && loc.partnerName.toLowerCase().includes(q)) ||
        (loc.notes && loc.notes.toLowerCase().includes(q)) ||
        (loc.phone && loc.phone.includes(q));
      return matchCat && matchSearch;
    });
  }, [locations, selectedCatId, search]);

  // Export to CSV
  const exportToCSV = () => {
    if (locations.length === 0) return;
    const headers = [
      'ID',
      'Nom Position',
      'Partenaire',
      'Catégorie',
      'Latitude',
      'Longitude',
      'Altitude (m)',
      'Précision (m)',
      'Téléphone',
      'Notes',
      'Agent',
      'Date Création',
    ];
    const rows = filtered.map((l) => [
      `"${l.id}"`,
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.partnerName || '').replace(/"/g, '""')}"`,
      `"${(l.categoryName || '').replace(/"/g, '""')}"`,
      l.latitude,
      l.longitude,
      l.altitude ?? '',
      l.accuracy ?? '',
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`,
      `"${(l.agentEmail || '').replace(/"/g, '""')}"`,
      `"${l.createdAt}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cartopartenaires_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to GeoJSON
  const exportToGeoJSON = () => {
    if (locations.length === 0) return;
    const geojson = {
      type: 'FeatureCollection',
      features: filtered.map((l) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [l.longitude, l.latitude, l.altitude || 0],
        },
        properties: {
          id: l.id,
          name: l.name,
          partnerName: l.partnerName,
          categoryName: l.categoryName,
          categoryColor: l.categoryColor,
          accuracyMeters: l.accuracy,
          altitudeMeters: l.altitude,
          phone: l.phone,
          notes: l.notes,
          agentEmail: l.agentEmail,
          createdAt: l.createdAt,
        },
      })),
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], {
      type: 'application/geo+json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cartopartenaires_terrain_${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Supprimer la position « ${name} » ?`)) {
      try {
        await deletePartnerLocation(id);
      } catch (err) {
        console.error('Erreur suppression:', err);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6 transition-colors">
      {/* Feedback Toast Notification */}
      {toastMessage && (
        <div
          className="fixed top-20 right-4 z-50 max-w-md bg-white dark:bg-slate-900 border-2 rounded-2xl p-4 shadow-2xl flex items-start gap-3 animate-fade-in"
          style={{ borderColor: toastMessage.color || accentConfig.hex }}
        >
          <span
            className="p-2 rounded-xl text-white shrink-0 mt-0.5 shadow-xs"
            style={{ backgroundColor: toastMessage.color || accentConfig.hex }}
          >
            <CheckCircle2 className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              {toastMessage.title}
            </h4>
            {toastMessage.subtitle && (
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {toastMessage.subtitle}
              </p>
            )}
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner & Collapsible Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl transition-all">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="p-2.5 rounded-xl text-white shadow-lg shrink-0"
              style={{ backgroundColor: accentConfig.hex }}
            >
              <MapPin className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {t('list.header')}
                </h1>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold border"
                  style={{
                    backgroundColor: `${accentConfig.hex}15`,
                    color: accentConfig.hex,
                    borderColor: `${accentConfig.hex}40`,
                  }}
                >
                  {filtered.length} / {locations.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('list.subtitle')}
              </p>
            </div>
          </div>

          {/* Toggle Filters / Export Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setFiltersCollapsed((p) => !p)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
              title={filtersCollapsed ? t('common.expand') : t('common.collapse')}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {filtersCollapsed ? t('common.options') : t('common.collapse')}
              </span>
              {filtersCollapsed ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Content: Search, Category Filter, and Export Actions */}
        {!filtersCollapsed && (
          <div className="p-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40 space-y-3 animate-fade-in">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('list.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-2 sm:w-64">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">
                    {t('map.allCategories')} ({locations.length})
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/50">
              <button
                onClick={exportToCSV}
                disabled={filtered.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 cursor-pointer transition-colors shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>CSV (Excel)</span>
              </button>
              <button
                onClick={exportToGeoJSON}
                disabled={filtered.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 cursor-pointer transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                <span>GeoJSON (SIG)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Locations Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((loc) => {
          return (
            <div
              key={loc.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm dark:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Category & Date */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => handleOpenCategoryModal(loc)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 group"
                    style={{ backgroundColor: loc.categoryColor || '#3B82F6' }}
                    title="Changer la catégorie de ce lieu (coordonnées et informations préservées)"
                  >
                    <span>● {loc.categoryName || 'Partenaire'}</span>
                    <Tag className="w-2.5 h-2.5 opacity-80 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {new Date(loc.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>

                {/* Location Name & Partner */}
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base leading-snug">{loc.name}</h3>
                {loc.partnerName && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {loc.partnerName}
                  </p>
                )}

                {/* Telemetry Box */}
                <div className="mt-3 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 text-[11px] grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[9px] uppercase font-bold">
                      Coordonnées GPS
                    </span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                      {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[9px] uppercase font-bold">
                      Altitude
                    </span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                      {loc.altitude !== null && loc.altitude !== undefined
                        ? `${loc.altitude} m`
                        : 'N/D'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[9px] uppercase font-bold">
                      Précision GPS
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {loc.accuracy !== null && loc.accuracy !== undefined
                        ? `± ${loc.accuracy} m`
                        : 'Optimale'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[9px] uppercase font-bold">
                      Agent Terrain
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 truncate block font-medium">
                      {loc.agentEmail?.split('@')[0] || 'Agent'}
                    </span>
                  </div>
                </div>

                {/* Phone & Notes */}
                {loc.phone && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-blue-500" />
                    <a href={`tel:${loc.phone}`} className="hover:underline font-medium">
                      {loc.phone}
                    </a>
                  </div>
                )}

                {loc.notes && (
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-950/40 p-2 rounded-lg border border-slate-200 dark:border-slate-800 line-clamp-2">
                    "{loc.notes}"
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                {/* Primary Route Button */}
                <button
                  onClick={() => onTraceRoute(loc)}
                  className={`w-full py-2 px-3 bg-gradient-to-r ${accentConfig.gradientClass} text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer border border-white/20`}
                  title="Tracer l'itinéraire en direct entre votre position exacte et ce partenaire"
                >
                  <Route className="w-4 h-4 text-white" />
                  <span>{t('list.traceRoute')}</span>
                </button>

                {/* Secondary Actions */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectOnMap(loc)}
                    className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-300 dark:border-slate-700/80"
                  >
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    <span>{t('list.locateOnMap')}</span>
                  </button>

                  {/* Dedicated Category Edit Button */}
                  <button
                    onClick={() => handleOpenCategoryModal(loc)}
                    className="py-1.5 px-2.5 bg-slate-100 hover:bg-amber-50 hover:border-amber-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-amber-700 dark:text-slate-300 dark:hover:text-amber-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer border border-slate-300 dark:border-slate-700 shadow-xs"
                    title="Modifier la catégorie de ce lieu (coordonnées et informations préservées)"
                  >
                    <Tag className="w-3.5 h-3.5 text-amber-500" />
                    <span className="hidden sm:inline">Catégorie</span>
                  </button>

                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors border border-slate-300 dark:border-slate-700"
                    title="Itinéraire dans Google Maps externe"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => handleDelete(loc.id, loc.name)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors cursor-pointer border border-slate-300 dark:border-slate-700"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <MapPin className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('list.noResults')}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Effectuez un relevé GPS terrain pour alimenter votre base cartographique.
          </p>
        </div>
      )}

      {/* Modal: Modifier la catégorie d'un lieu (coordonnées et informations préservées) */}
      {categoryModalLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
              <div className="flex items-center gap-3">
                <span
                  className="p-2.5 rounded-xl text-white shadow-md shrink-0"
                  style={{ backgroundColor: accentConfig.hex }}
                >
                  <Tag className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    {t('list.changeCategory')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-sm">
                    Lieu : <strong className="text-slate-800 dark:text-slate-200">{categoryModalLocation.name}</strong>
                    {categoryModalLocation.partnerName ? ` (${categoryModalLocation.partnerName})` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseCategoryModal}
                disabled={isSavingCategory}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Reassurance Banner: GPS Coordinates & Info 100% Preserved */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 dark:text-emerald-200">
                  <p className="font-bold">Garantie d'intégrité totale :</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300/90 mt-0.5 leading-relaxed">
                    Les coordonnées GPS (<span className="font-mono font-semibold">{categoryModalLocation.latitude.toFixed(5)}, {categoryModalLocation.longitude.toFixed(5)}</span>), 
                    l'altitude ({categoryModalLocation.altitude !== null ? `${categoryModalLocation.altitude} m` : 'N/D'}), 
                    la précision ({categoryModalLocation.accuracy !== null ? `± ${categoryModalLocation.accuracy} m` : 'Optimale'}), 
                    le contact ({categoryModalLocation.phone || 'Non renseigné'}) et vos notes restent <strong>strictement inchangés</strong>.
                  </p>
                </div>
              </div>

              {/* Current Category Display */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  {t('list.currentCategory')}
                </label>
                <div className="flex items-center gap-2 p-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: categoryModalLocation.categoryColor || '#3B82F6' }}
                  />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {categoryModalLocation.categoryName || 'Général'}
                  </span>
                </div>
              </div>

              {/* New Category Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                    {t('list.selectNewCategory')}
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {categories.length} catégories disponibles
                  </span>
                </div>

                {/* Quick filter if many categories */}
                {categories.length > 4 && (
                  <div className="relative mb-2.5">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Rechercher une catégorie..."
                      value={categoryModalSearch}
                      onChange={(e) => setCategoryModalSearch(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Categories List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {categories
                    .filter((c) =>
                      !categoryModalSearch ||
                      c.name.toLowerCase().includes(categoryModalSearch.toLowerCase()) ||
                      (c.description && c.description.toLowerCase().includes(categoryModalSearch.toLowerCase()))
                    )
                    .map((cat) => {
                      const isSelected = selectedNewCategoryId === cat.id;
                      const isCurrent = categoryModalLocation.categoryId === cat.id;

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedNewCategoryId(cat.id)}
                          className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30'
                              : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: cat.color }}
                            />
                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {cat.name}
                                </span>
                                {isCurrent && (
                                  <span className="text-[10px] px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full font-medium">
                                    Actuelle
                                  </span>
                                )}
                              </div>
                              {cat.description && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {cat.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 ml-3">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCloseCategoryModal}
                disabled={isSavingCategory}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveCategoryChange}
                disabled={
                  isSavingCategory ||
                  !selectedNewCategoryId ||
                  selectedNewCategoryId === categoryModalLocation.categoryId
                }
                className="px-4 py-2 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor:
                    selectedNewCategoryId && selectedNewCategoryId !== categoryModalLocation.categoryId
                      ? accentConfig.hex
                      : '#64748B',
                }}
              >
                {isSavingCategory ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Attribuer cette catégorie</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
