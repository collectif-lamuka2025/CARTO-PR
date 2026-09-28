import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Category, DISTINCT_COLORS, CATEGORY_ICONS } from '../types';
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
  const [name, setName] = useState('');
  const [color, setColor] = useState('#10B981');
  const [icon, setIcon] = useState('Store');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string; count: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

      await saveCategory(category);
      setStatusMessage(editingId ? 'Catégorie mise à jour avec succès.' : 'Nouvelle catégorie créée.');
      setTimeout(() => setStatusMessage(null), 3000);

      // Reset
      setName('');
      setDescription('');
      setColor('#10B981');
      setIcon('Store');
      setEditingId(null);
    } catch (error) {
      console.error('Erreur sauvegarde catégorie:', error);
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
      await deleteCategory(categoryToDelete.id, user?.uid);
      setStatusMessage(`Catégorie « ${categoryToDelete.name} » supprimée.`);
      setTimeout(() => setStatusMessage(null), 3000);
      setCategoryToDelete(null);
    } catch (err) {
      console.error('Erreur suppression catégorie:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreDefaults = async () => {
    try {
      await restoreStrategicCategories(user?.uid || 'guest');
      setStatusMessage('Catégories stratégiques restaurées avec succès.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Erreur restauration catégories:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6 transition-colors">
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
          onClick={handleRestoreDefaults}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-all cursor-pointer shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
          <span>Restaurer les catégories par défaut</span>
        </button>

        {statusMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-500/40 text-purple-700 dark:text-purple-200 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>{statusMessage}</span>
          </div>
        )}
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
              <span>Catégories Configurées ({categories.length})</span>
            </h2>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Disponibles pour tous les agents sur le terrain
            </span>
          </div>

          <div className="space-y-3">
            {categories.map((cat) => {
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

            {categories.length === 0 && (
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
    </div>
  );
};
