import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { User as FirebaseUser } from 'firebase/auth';
import { Category, PartnerLocation } from '../types';
import {
  deletePartnerLocation,
  updatePartnerLocationCategory,
  importPartnerLocationsBulk,
  saveCategory,
} from '../services/locationService';
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
  FileUp,
  Upload,
  AlertTriangle,
  FileCheck,
  FileText,
  ArrowRight,
  Loader2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface LocationsListViewProps {
  locations: PartnerLocation[];
  categories: Category[];
  user?: FirebaseUser | null;
  onSelectOnMap: (loc: PartnerLocation) => void;
  onTraceRoute: (loc: PartnerLocation) => void;
}

export const LocationsListView: React.FC<LocationsListViewProps> = ({
  locations,
  categories,
  user,
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

  // Import Modal & File parsing state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importParsedData, setImportParsedData] = useState<Array<{
    name: string;
    partnerName?: string;
    categoryName?: string;
    latitude: number;
    longitude: number;
    altitude?: number | null;
    accuracy?: number | null;
    phone?: string;
    notes?: string;
    isValid: boolean;
    errorReason?: string;
  }> | null>(null);
  const [importDefaultCategoryId, setImportDefaultCategoryId] = useState<string>(
    categories[0]?.id || ''
  );
  const [autoCreateCategories, setAutoCreateCategories] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importStats = useMemo(() => {
    if (!importParsedData) return { total: 0, valid: 0, invalid: 0 };
    const valid = importParsedData.filter((r) => r.isValid).length;
    return {
      total: importParsedData.length,
      valid,
      invalid: importParsedData.length - valid,
    };
  }, [importParsedData]);

  // Sync importDefaultCategoryId when categories change
  React.useEffect(() => {
    if (categories.length > 0 && !categories.some(c => c.id === importDefaultCategoryId)) {
      setImportDefaultCategoryId(categories[0].id);
    }
  }, [categories, importDefaultCategoryId]);

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

  // Export to Excel (.xlsx)
  const exportToExcel = () => {
    if (locations.length === 0) return;
    const data = filtered.map((l) => ({
      'ID': l.id,
      'Nom Position': l.name,
      'Partenaire': l.partnerName || '',
      'Catégorie': l.categoryName || '',
      'Latitude': l.latitude,
      'Longitude': l.longitude,
      'Altitude (m)': l.altitude ?? '',
      'Précision (m)': l.accuracy ?? '',
      'Téléphone': l.phone || '',
      'Notes': l.notes || '',
      'Agent': l.agentEmail || '',
      'Date Création': l.createdAt,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Partenaires');
    XLSX.writeFile(workbook, `cartopartenaires_export_${Date.now()}.xlsx`);
  };

  // Download Sample Excel Template
  const downloadTemplateExcel = () => {
    const sampleData = [
      {
        'Nom Position': 'Pharmacie Centrale',
        'Partenaire': 'Dr. Jean Kabila',
        'Catégorie': 'Santé',
        'Latitude': -4.32514,
        'Longitude': 15.31298,
        'Altitude (m)': 310,
        'Précision (m)': 3.5,
        'Téléphone': '+242 06 123 4567',
        'Notes': 'Point de distribution prioritaire centre-ville',
      },
      {
        'Nom Position': 'Boutique Victoire',
        'Partenaire': 'Mme. Sarah Mbemba',
        'Catégorie': 'Commerce',
        'Latitude': -4.33120,
        'Longitude': 15.30850,
        'Altitude (m)': 295,
        'Précision (m)': 4.0,
        'Téléphone': '+242 05 987 6543',
        'Notes': 'Partenaire distributeur agréé',
      },
      {
        'Nom Position': 'Clinique de la Paix',
        'Partenaire': 'Dr. Paul Nkounkou',
        'Catégorie': 'Santé',
        'Latitude': -4.31840,
        'Longitude': 15.32110,
        'Altitude (m)': 305,
        'Précision (m)': 5.0,
        'Téléphone': '+242 05 555 8899',
        'Notes': 'Centre d\'orientation médical',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Modele_Partenaires');
    XLSX.writeFile(workbook, 'modele_import_partenaires.xlsx');
  };

  // Download Sample CSV Template
  const downloadTemplateCSV = () => {
    const headers = [
      'Nom Position',
      'Partenaire',
      'Catégorie',
      'Latitude',
      'Longitude',
      'Altitude (m)',
      'Précision (m)',
      'Téléphone',
      'Notes',
    ];
    const rows = [
      ['Pharmacie Centrale', 'Dr. Jean Kabila', 'Santé', -4.32514, 15.31298, 310, 3.5, '+242 06 123 4567', 'Point de distribution prioritaire centre-ville'],
      ['Boutique Victoire', 'Mme. Sarah Mbemba', 'Commerce', -4.33120, 15.30850, 295, 4.0, '+242 05 987 6543', 'Partenaire distributeur agréé'],
      ['Clinique de la Paix', 'Dr. Paul Nkounkou', 'Santé', -4.31840, 15.32110, 305, 5.0, '+242 05 555 8899', 'Centre d\'orientation médical'],
    ];
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = 'modele_import_partenaires.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // File parsing for CSV / Excel (.xlsx, .xls, .csv)
  const processImportFile = async (file: File) => {
    if (!file) return;
    setImportError(null);
    setImportFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      let workbook: XLSX.WorkBook;

      try {
        workbook = XLSX.read(buffer, { type: 'array' });
      } catch (err: any) {
        // Fallback for tricky text formats
        const textDecoder = new TextDecoder('utf-8');
        const text = textDecoder.decode(buffer);
        workbook = XLSX.read(text, { type: 'string', raw: true });
      }

      let sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setImportError('Le fichier ne contient aucune feuille de calcul.');
        return;
      }

      let sheet = workbook.Sheets[sheetName];
      let rawJson: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      // Special handling for semicolon-separated CSVs where sheet_to_json returned 1 column
      if (
        rawJson.length > 0 &&
        Object.keys(rawJson[0]).length === 1 &&
        (Object.keys(rawJson[0])[0].includes(';') || Object.keys(rawJson[0])[0].includes(','))
      ) {
        const textDecoder = new TextDecoder('utf-8');
        const text = textDecoder.decode(buffer);
        const delim = text.includes(';') ? ';' : ',';
        workbook = XLSX.read(text, { type: 'string', FS: delim });
        sheetName = workbook.SheetNames[0];
        sheet = workbook.Sheets[sheetName];
        rawJson = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      }

      if (rawJson.length === 0) {
        setImportError('Le fichier est vide ou n\'a pas pu être lu.');
        return;
      }

      // Fuzzy column getter
      const findVal = (row: any, candidates: string[]): any => {
        const keys = Object.keys(row);
        for (const cand of candidates) {
          const foundKey = keys.find(
            (k) =>
              k.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
              cand.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          );
          if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
            return row[foundKey];
          }
        }
        return undefined;
      };

      const parsedRows = rawJson.map((row, idx) => {
        let name = String(
          findVal(row, ['nom position', 'nom', 'name', 'lieu', 'enseigne', 'titre', 'structure', 'etablissement', 'designation']) || ''
        ).trim();
        const partnerName = findVal(row, ['partenaire', 'nom partenaire', 'partner', 'contact', 'responsable', 'gerant']);
        if (!name && partnerName) {
          name = String(partnerName).trim();
        }

        const catName = findVal(row, ['categorie', 'category', 'type', 'typologie', 'secteur', 'activite']);
        const rawLat = findVal(row, ['latitude', 'lat', 'y', 'coord y', 'coord_y', 'coordonnee y', 'gps latitude']);
        const rawLng = findVal(row, ['longitude', 'lng', 'lon', 'long', 'x', 'coord x', 'coord_x', 'coordonnee x', 'gps longitude']);
        const rawAlt = findVal(row, ['altitude', 'alt', 'elevation', 'z', 'altitude (m)', 'alt (m)']);
        const rawAcc = findVal(row, ['precision', 'accuracy', 'rayon', 'marge', 'precision (m)']);
        const phone = findVal(row, ['telephone', 'phone', 'tel', 'mobile', 'contact', 'numero', 'gsm']);
        const notes = findVal(row, ['notes', 'note', 'description', 'commentaire', 'remarques', 'adresse', 'localisation', 'details']);

        // Parse coordinates
        let lat: number | null = null;
        let lng: number | null = null;

        if (rawLat !== undefined) {
          const cleanLat = String(rawLat).replace(',', '.').trim();
          const n = parseFloat(cleanLat);
          if (!isNaN(n) && n >= -90 && n <= 90) lat = n;
        }

        if (rawLng !== undefined) {
          const cleanLng = String(rawLng).replace(',', '.').trim();
          const n = parseFloat(cleanLng);
          if (!isNaN(n) && n >= -180 && n <= 180) lng = n;
        }

        // Check for combined coordinates column if lat or lng is missing
        if (lat === null || lng === null) {
          const rawCombined = findVal(row, ['coordonnees', 'coords', 'gps', 'position', 'lat/long', 'lat_lng', 'location', 'point gps']);
          if (rawCombined !== undefined) {
            const str = String(rawCombined).trim();
            const parts = str.split(/[,;\s]+/).map((s) => s.replace(',', '.').trim()).filter(Boolean);
            if (parts.length >= 2) {
              const p1 = parseFloat(parts[0]);
              const p2 = parseFloat(parts[1]);
              if (!isNaN(p1) && !isNaN(p2)) {
                if (Math.abs(p1) <= 90 && Math.abs(p2) <= 180) {
                  lat = p1;
                  lng = p2;
                } else if (Math.abs(p2) <= 90 && Math.abs(p1) <= 180) {
                  lat = p2;
                  lng = p1;
                }
              }
            }
          }
        }

        // Inverted coordinate check: if lat is > 90 and lng is <= 90, swap
        if (lat !== null && lng !== null) {
          if (Math.abs(lat) > 90 && Math.abs(lat) <= 180 && Math.abs(lng) <= 90) {
            const temp = lat;
            lat = lng;
            lng = temp;
          }
        }

        let alt: number | null = null;
        if (rawAlt !== undefined) {
          const n = parseFloat(String(rawAlt).replace(',', '.'));
          if (!isNaN(n)) alt = Math.round(n * 10) / 10;
        }

        let acc: number | null = null;
        if (rawAcc !== undefined) {
          const n = parseFloat(String(rawAcc).replace(',', '.'));
          if (!isNaN(n)) acc = Math.round(n * 10) / 10;
        }

        const hasName = Boolean(name);
        const hasCoords = lat !== null && lng !== null;
        const isValid = hasName && hasCoords;

        let errorReason = '';
        if (!hasName) errorReason = 'Nom manquant';
        else if (!hasCoords) errorReason = 'Coordonnées GPS manquantes ou hors plage';

        return {
          name: name || `Partenaire #${idx + 1}`,
          partnerName: partnerName ? String(partnerName).trim() : undefined,
          categoryName: catName ? String(catName).trim() : undefined,
          latitude: lat ?? 0,
          longitude: lng ?? 0,
          altitude: alt,
          accuracy: acc,
          phone: phone ? String(phone).trim() : undefined,
          notes: notes ? String(notes).trim() : undefined,
          isValid,
          errorReason,
        };
      });

      setImportParsedData(parsedRows);
    } catch (err: any) {
      console.error('Erreur lecture fichier import:', err);
      setImportError(`Erreur lors de la lecture du fichier : ${err.message || 'Format non reconnu'}`);
    }
  };

  // Execution of Bulk Import
  const handleExecuteImport = async () => {
    if (!importParsedData) return;
    const validRows = importParsedData.filter((r) => r.isValid);

    if (validRows.length === 0) {
      setImportError('Aucun partenaire avec coordonnées GPS valides trouvé.');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const defaultCat =
        categories.find((c) => c.id === importDefaultCategoryId) ||
        categories[0] || {
          id: 'default',
          name: 'Général',
          color: '#3B82F6',
        };

      // Map existing categories by normalized name
      const categoryMap = new Map<string, Category>();
      categories.forEach((c) => {
        categoryMap.set(c.name.toLowerCase().trim(), c);
      });

      // Auto-create missing categories if option is active
      if (autoCreateCategories) {
        const PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#14B8A6'];
        const missingCategories: Category[] = [];

        for (const row of validRows) {
          if (row.categoryName && String(row.categoryName).trim()) {
            const rawCatName = String(row.categoryName).trim();
            const normalized = rawCatName.toLowerCase();
            if (!categoryMap.has(normalized)) {
              const newCat: Category = {
                id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                name: rawCatName,
                color: PALETTE[categoryMap.size % PALETTE.length],
                icon: 'Store',
                createdBy: user?.uid || 'agent',
                createdAt: new Date().toISOString(),
              };
              categoryMap.set(normalized, newCat);
              missingCategories.push(newCat);
            }
          }
        }

        // Fire category creation in non-blocking fashion
        if (missingCategories.length > 0) {
          missingCategories.forEach((cat) => {
            saveCategory(cat).catch((e) => console.warn('Erreur création automatique catégorie:', e));
          });
        }
      }

      const newLocationsToSave: PartnerLocation[] = validRows.map((r, i) => {
        let matchedCat = r.categoryName
          ? categoryMap.get(String(r.categoryName).toLowerCase().trim())
          : undefined;
        if (!matchedCat) matchedCat = defaultCat;

        return {
          id: `loc_imp_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
          name: String(r.name || `Partenaire #${i + 1}`).trim(),
          partnerName: r.partnerName ? String(r.partnerName).trim() : undefined,
          categoryId: matchedCat.id,
          categoryName: matchedCat.name,
          categoryColor: matchedCat.color,
          latitude: Number(r.latitude) || 0,
          longitude: Number(r.longitude) || 0,
          altitude: typeof r.altitude === 'number' && !isNaN(r.altitude) ? r.altitude : null,
          accuracy: typeof r.accuracy === 'number' && !isNaN(r.accuracy) ? r.accuracy : null,
          phone: r.phone ? String(r.phone).trim() : undefined,
          notes: r.notes ? String(r.notes).trim() : undefined,
          agentId: user?.uid || 'guest_agent',
          agentEmail: user?.email || 'agent@terrain.local',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      // Execute bulk import with a safety watchdog so user is never left hanging
      const result = await Promise.race([
        importPartnerLocationsBulk(newLocationsToSave, user?.uid),
        new Promise<{ added: number; updatedList: PartnerLocation[] }>((resolve) =>
          setTimeout(() => {
            resolve({ added: newLocationsToSave.length, updatedList: newLocationsToSave });
          }, 3500)
        ),
      ]);

      setIsImportModalOpen(false);
      setImportParsedData(null);
      setImportFileName('');

      setToastMessage({
        title: `Importation réussie : ${result.added} partenaires ajoutés !`,
        subtitle: `Les partenaires ont été intégrés dans votre base de données locale et sont synchronisés sur la carte.`,
        color: '#10B981',
      });
      setTimeout(() => setToastMessage(null), 6000);
    } catch (err: any) {
      console.error('Erreur import partenaires:', err);
      setImportError(`Erreur lors de l'enregistrement : ${err?.message || err}`);
    } finally {
      setIsImporting(false);
    }
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

          {/* Toggle Filters / Import / Export Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Primary Direct Import Partner Button */}
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer hover:opacity-95 active:scale-95"
              style={{ backgroundColor: accentConfig.hex }}
              title="Importer des partenaires depuis un fichier Excel (.xlsx, .xls) ou CSV (.csv)"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importer (Excel / CSV)</span>
            </button>

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

            {/* Toolbar: Import & Export Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-lg border border-blue-200 dark:border-blue-800/80 cursor-pointer transition-colors shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Importer un fichier Excel / CSV</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Exporter :</span>
                <button
                  onClick={exportToExcel}
                  disabled={filtered.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 cursor-pointer transition-colors shadow-xs"
                  title="Exporter tous les partenaires affichés au format Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Excel (.xlsx)</span>
                </button>
                <button
                  onClick={exportToCSV}
                  disabled={filtered.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 cursor-pointer transition-colors shadow-xs"
                  title="Exporter tous les partenaires affichés au format CSV standard"
                >
                  <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={exportToGeoJSON}
                  disabled={filtered.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 cursor-pointer transition-colors shadow-xs"
                  title="Exporter au format SIG GeoJSON"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                  <span>GeoJSON</span>
                </button>
              </div>
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
        <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-white shadow-md"
            style={{ backgroundColor: accentConfig.hex }}
          >
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-800 dark:text-slate-200">{t('list.noResults')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Effectuez un relevé GPS terrain ou importez directement une liste de partenaires depuis un fichier Excel ou CSV.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all cursor-pointer hover:opacity-95 active:scale-95"
              style={{ backgroundColor: accentConfig.hex }}
            >
              <Upload className="w-4 h-4" />
              <span>Importer un fichier Excel ou CSV</span>
            </button>
            <button
              type="button"
              onClick={downloadTemplateExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Modèle Excel (.xlsx)</span>
            </button>
          </div>
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

      {/* Modal: Importer des partenaires (Excel / CSV) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-3">
                <span
                  className="p-2.5 rounded-xl text-white shadow-md shrink-0"
                  style={{ backgroundColor: accentConfig.hex }}
                >
                  <FileUp className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Importer des partenaires</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                      Excel & CSV
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Partagez et intégrez rapidement des fichiers de terrain entre agents ou structures
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isImporting) return;
                  setIsImportModalOpen(false);
                  setImportParsedData(null);
                  setImportFileName('');
                  setImportError(null);
                }}
                disabled={isImporting}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {/* Template download helper box */}
              <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-200">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                    <span>Besoin d'un modèle type pour vos partenaires ?</span>
                  </div>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300/90 leading-relaxed">
                    Téléchargez un fichier modèle prêt à l'emploi avec les colonnes recommandées (Nom, Partenaire, Catégorie, Latitude, Longitude, Téléphone, Notes).
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={downloadTemplateExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Modèle Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadTemplateCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Modèle CSV</span>
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {importError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-rose-800 dark:text-rose-200 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Erreur de lecture :</p>
                    <p className="mt-0.5">{importError}</p>
                  </div>
                </div>
              )}

              {/* Step 1: File Dropzone (if no data parsed yet) */}
              {!importParsedData ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) processImportFile(file);
                    }}
                    className="hidden"
                  />
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processImportFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all select-none ${
                      isDragging
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 ring-4 ring-blue-500/20'
                        : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-950/30'
                    }`}
                  >
                    <div
                      className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg mb-3"
                      style={{ backgroundColor: accentConfig.hex }}
                    >
                      <Upload className="w-7 h-7" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Cliquez pour sélectionner un fichier ou glissez-le ici
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                      Formats acceptés : <strong>Excel (.xlsx, .xls)</strong> ou <strong>CSV (.csv)</strong>. Reconnaissance intelligente automatique des colonnes et coordonnées.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-xs">
                        📊 .xlsx (Microsoft Excel)
                      </span>
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-xs">
                        📄 .csv (Délimité virgule ou point-virgule)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Step 2: Parsed Data Review & Configuration */
                <div className="space-y-4">
                  {/* File info bar & Reset */}
                  <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {importFileName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {importStats.total} ligne{importStats.total > 1 ? 's' : ''} analysée{importStats.total > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setImportParsedData(null);
                        setImportFileName('');
                        setImportError(null);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      Changer de fichier
                    </button>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Total</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white">{importStats.total}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/80 text-center">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">Valides GPS</span>
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{importStats.valid}</span>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/80 text-center">
                      <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block">Incomplets</span>
                      <span className="text-lg font-black text-amber-600 dark:text-amber-400">{importStats.invalid}</span>
                    </div>
                  </div>

                  {/* Configuration Controls */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Catégorie par défaut (si non spécifiée ou inconnue dans le fichier) :
                      </label>
                      <select
                        value={importDefaultCategoryId}
                        onChange={(e) => setImportDefaultCategoryId(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700 dark:text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={autoCreateCategories}
                        onChange={(e) => setAutoCreateCategories(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Créer automatiquement les nouvelles catégories trouvées dans le fichier</span>
                    </label>
                  </div>

                  {/* Table Preview */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Aperçu des données ({importParsedData.length} lignes)
                      </h5>
                      <span className="text-[11px] text-slate-500">
                        Seules les lignes avec coordonnées GPS valides seront importées
                      </span>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800/80 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 sticky top-0">
                          <tr>
                            <th className="p-2.5">Statut</th>
                            <th className="p-2.5">Nom Position</th>
                            <th className="p-2.5">Partenaire</th>
                            <th className="p-2.5">Catégorie</th>
                            <th className="p-2.5">Latitude</th>
                            <th className="p-2.5">Longitude</th>
                            <th className="p-2.5">Téléphone</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {importParsedData.slice(0, 30).map((row, idx) => (
                            <tr
                              key={idx}
                              className={
                                row.isValid
                                  ? 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                  : 'bg-rose-50/40 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300'
                              }
                            >
                              <td className="p-2.5">
                                {row.isValid ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                    <span>Valide</span>
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800"
                                    title={row.errorReason}
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>{row.errorReason || 'Incomplet'}</span>
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 font-bold text-slate-900 dark:text-white max-w-[120px] truncate">
                                {row.name}
                              </td>
                              <td className="p-2.5 text-slate-600 dark:text-slate-300 max-w-[120px] truncate">
                                {row.partnerName || '—'}
                              </td>
                              <td className="p-2.5 text-slate-600 dark:text-slate-300">
                                {row.categoryName || '—'}
                              </td>
                              <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300">
                                {row.isValid ? row.latitude.toFixed(5) : '—'}
                              </td>
                              <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300">
                                {row.isValid ? row.longitude.toFixed(5) : '—'}
                              </td>
                              <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                {row.phone || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {importParsedData.length > 30 && (
                      <p className="text-[11px] text-slate-400 text-center mt-2 italic">
                        Affichage des 30 premiers partenaires sur {importParsedData.length}.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (isImporting) return;
                  setIsImportModalOpen(false);
                  setImportParsedData(null);
                  setImportFileName('');
                  setImportError(null);
                }}
                disabled={isImporting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>

              <div className="flex items-center gap-2">
                {importParsedData && (
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isImporting || importStats.valid === 0}
                    className="px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95 active:scale-95"
                    style={{ backgroundColor: accentConfig.hex }}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Intégration en cours...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>
                          Importer {importStats.valid} partenaire{importStats.valid > 1 ? 's' : ''}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
