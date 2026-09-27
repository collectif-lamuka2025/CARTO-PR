export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
  createdBy: string;
  createdAt: string;
}

export interface PartnerLocation {
  id: string;
  name: string;
  partnerName?: string;
  categoryId: string;
  categoryName?: string;
  categoryColor?: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  notes?: string;
  phone?: string;
  agentId: string;
  agentEmail?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GPSState {
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number | null;
  error: string | null;
  loading: boolean;
  watching: boolean;
}

export const DISTINCT_COLORS = [
  { name: 'Émeraude Vif', value: '#10B981', ring: 'rgba(16, 185, 129, 0.4)' },
  { name: 'Bleu Électrique', value: '#06B6D4', ring: 'rgba(6, 182, 212, 0.4)' },
  { name: 'Indigo Profond', value: '#6366F1', ring: 'rgba(99, 102, 241, 0.4)' },
  { name: 'Pourpre Royal', value: '#A855F7', ring: 'rgba(168, 85, 247, 0.4)' },
  { name: 'Rose Fluo', value: '#EC4899', ring: 'rgba(236, 72, 153, 0.4)' },
  { name: 'Rouge Écarlate', value: '#EF4444', ring: 'rgba(239, 68, 68, 0.4)' },
  { name: 'Orange Braise', value: '#F97316', ring: 'rgba(249, 115, 22, 0.4)' },
  { name: 'Jaune Solaire', value: '#EAB308', ring: 'rgba(234, 179, 8, 0.4)' },
  { name: 'Turquoise Océan', value: '#14B8A6', ring: 'rgba(20, 184, 166, 0.4)' },
];

export const CATEGORY_ICONS = [
  { id: 'Store', label: 'Commerce / Boutique' },
  { id: 'Building', label: 'Bureau / Entreprise' },
  { id: 'HeartHandshake', label: 'Partenaire ONG' },
  { id: 'GraduationCap', label: 'Éducation / Formation' },
  { id: 'Activity', label: 'Santé / Clinique' },
  { id: 'Truck', label: 'Logistique / Dépôt' },
  { id: 'Home', label: 'Domicile / Résidence' },
  { id: 'Sparkles', label: 'Autre point clé' },
];
