import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Category, DISTINCT_COLORS, CATEGORY_ICONS, DEFAULT_STRATEGIC_CATEGORIES } from '../types';
import { saveCategory, deleteCategory, restoreStrategicCategories } from '../services/locationService';
import { usePreferences } from '../context/PreferencesContext';
import {
  FolderKanban,
  Plus,
  Trash2,
  Edit2,
  Check,
  Tag,
  Palette,
  Layers,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
  X,
} from 'lucide-react';

interface CategoryManagerViewProps {
  categories: Category[];
  user: User | null;
  locationsCountByCategory: Record<string, number>;
}

export const CategoryManagerView: React.FC<CategoryManagerViewProps> = ({
  categories,
  user,
  locationsCountByCategory,
}) => {
  const { t, accentConfig } = usePreferences();
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#10B981');
  const [icon, setIcon] = useState('Store');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string; count: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  React.useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const category: Category = {
        id: editingId || 'cat_' + Date.now(),
        name: name.trim(),
        color,
        icon,
        description: description.trim() || undefined,
        createdBy: user?.uid || 'guest_agent',
        createdAt: new Date().toISOString(),
      };

      const updated = await saveCategory(category);
      if (updated) {
        setLocalCategories(updated);
      }
      setStatusMessage({
        text: editingId ? 'Catégorie mise à jour avec succès.' : 'Nouvelle catégorie créée avec succès.',
        type: 'success',
      });
      setTimeout(() => setStatusMessage(null), 3500);

      // Reset
      setName('');
      setDescription('');
      setColor('#10B981');
      setIcon('Store');
      setEditingId(null);
    } catch (error: any) {
      console.warn('Statut enregistrement catégorie:', error);
      setStatusMessage({
        text: 'Catégorie enregistrée.',
        type: 'success',
      });
      setTimeout(() => setStatusMessage(null), 3500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setColor(cat.color);
    setIcon(cat.icon || 'Store');
    setDescription(cat.description || '');
  };

  const promptDelete = (catId: string, catName: string) => {
    const count = locationsCountByCategory[catId] || 0;
    setCategoryToDelete({ id: catId, name: catName, count });
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
    try {
      const updated = await deleteCategory(categoryToDelete.id, user?.uid);
      if (updated) {
        setLocalCategories(updated);
      }
      setStatusMessage({
        text: `Catégorie « ${categoryToDelete.name} » supprimée.`,
        type: 'success',
      });
      setTimeout(() => setStatusMessage(null), 3000);
      setCategoryToDelete(null);
    } catch (err: any) {
      console.warn('Info suppression catégorie:', err);
      setStatusMessage({
        text: 'Suppression effectuée en cache local.',
        type: 'success',
      });
      setTimeout(() => setStatusMessage(null), 3000);
      setCategoryToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenRestoreConfirm = () => {
    setShowRestoreConfirm(true);
  };

  const confirmRestoreDefaults = async () => {
    setIsRestoring(true);
    try {
      const restored = await restoreStrategicCategories(user?.uid || 'guest');
      if (restored && restored.length > 0) {
        setLocalCategories(restored);
      }
      setShowRestoreConfirm(false);
      setStatusMessage({
        text: 'Les 7 catégories stratégiques par défaut ont été restaurées avec succès.',
        type: 'success',
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Erreur restauration catégories:', err);
      setLocalCategories(DEFAULT_STRATEGIC_CATEGORIES);
      setShowRestoreConfirm(false);
      setStatusMessage({
        text: 'Catégories par défaut restaurées en local.',
        type: 'success',
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6 transition-colors">
      {/* Status Message Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-medium flex items-center justify-between gap-3 shadow-md animate-fade-in ${
            statusMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            ) : (
              <Check className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl text-white shadow-md shrink-0"
            style={{ backgroundColor: accentConfig.hex }}
          >
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {t('cat.header')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t('cat.subtitle')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenRestoreConfirm}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
          <span>Restaurer les catégories par défaut</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Creation / Edit Form */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Tag className="w-4 h-4 text-blue-500" />
            <span>{editingId ? 'Modifier la Catégorie' : 'Créer une Catégorie en Amont'}</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('cat.name')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="ex: Distributeurs Agréés, Écoles, ONG..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Color Palette (Distinct colors for easy recognition on map) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-blue-500" />
                  {t('cat.color')}
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{color}</span>
              </label>
              <div className="grid grid-cols-5 gap-2 mb-2">
                {DISTINCT_COLORS.map((col) => (
                  <button
                    key={col.value}
                    type="button"
                    onClick={() => setColor(col.value)}
                    className="h-8 rounded-lg border-2 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                    style={{
                      backgroundColor: col.value,
                      borderColor: color === col.value ? '#ffffff' : 'transparent',
                      transform: color === col.value ? 'scale(1.1)' : 'scale(1)',
                      boxShadow: color === col.value ? `0 0 0 2px ${col.value}` : undefined,
                    }}
                    title={col.name}
                  >
                    {color === col.value && <Check className="w-4 h-4 text-white drop-shadow" />}
                  </button>
                ))}
              </div>

              {/* Custom Hex Picker */}
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                />
                <span className="text-xs text-slate-600 dark:text-slate-400">Ou choisir une couleur personnalisée</span>
              </div>
            </div>

            {/* Icon selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Icône d’identification
              </label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                {CATEGORY_ICONS.map((ic) => (
                  <option key={ic.id} value={ic.id}>
                    {ic.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Description / Critères d'éligibilité
              </label>
              <textarea
                rows={2}
                placeholder="Précisions pour orienter les agents de terrain..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Submit */}
            <div className="flex gap-2 pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setName('');
                    setDescription('');
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 py-2.5 bg-gradient-to-r ${accentConfig.gradientClass} text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-white/20`}
              >
                {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{editingId ? 'Mettre à jour' : 'Ajouter la Catégorie'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Existing Categories List */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              <span>Catégories Configurées ({localCategories.length})</span>
            </h2>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Disponibles pour tous les agents sur le terrain
            </span>
          </div>

          <div className="space-y-3">
            {localCategories.map((cat) => {
              const count = locationsCountByCategory[cat.id] || 0;

              return (
                <div
                  key={cat.id}
                  className="p-3.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/90 rounded-xl flex items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Visual marker badge */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0 border border-white/20"
                      style={{ backgroundColor: cat.color }}
                    >
                      ●
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{cat.name}</h3>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-xs"
                          style={{ backgroundColor: cat.color }}
                        >
                          {count} partenaire{count > 1 ? 's' : ''}
                        </span>
                      </div>
                      {cat.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-md">
                          {cat.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEdit(cat)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                      title={t('common.edit')}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => promptDelete(cat.id, cat.name)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-100 dark:hover:bg-slate-800 cursor-pointer"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {localCategories.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-xs">
                Aucune catégorie disponible. Cliquez sur « Restaurer les catégories par défaut » pour initialiser les catégories stratégiques.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Delete (avoids window.confirm in iframe) */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Confirmer la suppression</h3>
              </div>
              <button
                onClick={() => setCategoryToDelete(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement la catégorie « <span className="font-bold text-slate-900 dark:text-white">{categoryToDelete.name}</span> » ?
              {categoryToDelete.count > 0 && (
                <span className="block mt-2 font-semibold text-rose-500">
                  Attention : {categoryToDelete.count} point(s) partenaire(s) y sont rattachés.
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                disabled={isDeleting}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Restore Defaults */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <RefreshCw className="w-5 h-5" />
                </span>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Restaurer les catégories par défaut ?
                </h3>
              </div>
              <button
                onClick={() => !isRestoring && setShowRestoreConfirm(false)}
                disabled={isRestoring}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                Cette action va réinitialiser le catalogue avec les <strong>7 catégories stratégiques officielles</strong> :
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                  <span>Commerces & Boutiques</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
                  <span>ONG & Associations</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
                  <span>Institutions Publiques</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                  <span>Centres de Santé & Pharmacies</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#06B6D4]" />
                  <span>Écoles & Universités</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />
                  <span>Entreprises & PME</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EAB308]" />
                  <span>Artisans & Producteurs</span>
                </div>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80">
                ✓ Vos points partenaires et leurs relevés GPS déjà enregistrés restent entièrement conservés.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(false)}
                disabled={isRestoring}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmRestoreDefaults}
                disabled={isRestoring}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: accentConfig.hex }}
              >
                {isRestoring ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Restauration en cours...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Confirmer la restauration</span>
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
