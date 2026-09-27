import React, { useState } from 'react';
import { PartnerLocation, GPSState } from '../types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { FormattedAIResponse } from './FormattedAIResponse';
import {
  Sparkles,
  Navigation,
  Compass,
  Send,
  Loader2,
  CheckCircle2,
  MapPin,
  HelpCircle,
  Lightbulb,
  WifiOff,
} from 'lucide-react';

interface FieldAssistantViewProps {
  gps: GPSState;
  locations: PartnerLocation[];
}

export const FieldAssistantView: React.FC<FieldAssistantViewProps> = ({
  gps,
  locations,
}) => {
  const isOnline = useOnlineStatus();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('current');
  const [userPrompt, setUserPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [groundingMetadata, setGroundingMetadata] = useState<any>(null);

  // Active target coords
  const selectedLoc = locations.find((l) => l.id === selectedLocationId);
  const targetLat = selectedLocationId === 'current' ? gps.latitude : selectedLoc?.latitude;
  const targetLng = selectedLocationId === 'current' ? gps.longitude : selectedLoc?.longitude;
  const targetName = selectedLocationId === 'current' ? 'Position GPS Actuelle' : selectedLoc?.name;

  const handleAskAssistant = async (predefinedPrompt?: string) => {
    const promptToSend = predefinedPrompt || userPrompt;
    if (!promptToSend.trim()) return;

    if (targetLat === null || targetLat === undefined || targetLng === null || targetLng === undefined) {
      alert('Veuillez activer votre GPS ou sélectionner un partenaire avec des coordonnées valides.');
      return;
    }

    setLoading(true);
    setResponse(null);
    setGroundingMetadata(null);

    try {
      const res = await fetch('/api/field-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToSend,
          latitude: targetLat,
          longitude: targetLng,
          partnerName: targetName,
          category: selectedLoc?.categoryName || 'Général',
        }),
      });

      const data = await res.json();
      if (data.success && data.text) {
        setResponse(data.text);
        setGroundingMetadata(data.groundingMetadata);
      } else {
        setResponse(
          data.message ||
            'Assistant opérationnel. Note: pour activer les données Google Maps en temps réel enrichies par Gemini, assurez-vous que la clé GEMINI_API_KEY est configurée.'
        );
      }
    } catch (err: any) {
      console.warn('Statut assistant terrain:', err?.message || err);
      setResponse('Impossible de joindre le service d’assistance terrain pour le moment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Assistant Terrain IA & Ancrage Google Maps
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Propulsé par Gemini 3.8 Flash avec l'outil Google Maps pour guider vos agents,
              identifier les repères locaux et analyser l’environnement de vos partenaires.
            </p>
          </div>
        </div>
      </div>

      {/* Target Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Cible géographique de l'analyse
          </label>
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
          >
            <option value="current">
              📍 Ma position GPS actuelle en temps réel{' '}
              {gps.latitude ? `(${gps.latitude.toFixed(4)}, ${gps.longitude?.toFixed(4)})` : ''}
            </option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                🏢 {loc.name} ({loc.categoryName || 'Partenaire'}) - {loc.latitude.toFixed(4)},{' '}
                {loc.longitude.toFixed(4)}
              </option>
            ))}
          </select>
        </div>

        {/* Quick prompt templates */}
        <div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            Suggestions de requêtes terrain rapides :
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() =>
                handleAskAssistant(
                  'Quels sont les points de repère notables, carrefours et infrastructures clés autour de cette position pour guider l’agent ?'
                )
              }
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-amber-500 text-left text-xs text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              🏛️ <strong>Repères & carrefours</strong>
              <span className="block text-[11px] text-slate-500 mt-1">
                Identifier les accès et bâtiments connus à proximité.
              </span>
            </button>

            <button
              onClick={() =>
                handleAskAssistant(
                  'Quels conseils logistiques et de sécurité donner à un agent de terrain pour se rendre à cette localisation ?'
                )
              }
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-amber-500 text-left text-xs text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              🚗 <strong>Accès & logistique</strong>
              <span className="block text-[11px] text-slate-500 mt-1">
                Conseils d'approche routière et accessibilité.
              </span>
            </button>

            <button
              onClick={() =>
                handleAskAssistant(
                  'Fournis une check-list de 4 questions pertinentes à poser lors d’un entretien de prospection de partenariat.'
                )
              }
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-amber-500 text-left text-xs text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              📋 <strong>Check-list d’entretien</strong>
              <span className="block text-[11px] text-slate-500 mt-1">
                Questions clés pour la rencontre partenaire.
              </span>
            </button>
          </div>
        </div>

        {/* Offline Banner if disconnected */}
        {!isOnline && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-500/40 rounded-xl text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Mode Hors-Ligne :</strong> Les requêtes IA d'analyse en direct nécessitent internet. Vos relevés GPS, vos fiches partenaires et vos catégories restent 100% opérationnels en local.
            </span>
          </div>
        )}

        {/* Freeform Prompt input */}
        <div className="flex gap-2">
          <input
            type="text"
            disabled={!isOnline}
            placeholder={
              isOnline
                ? 'Posez une question spécifique sur la zone, le quartier ou le partenaire...'
                : 'Connexion internet requise pour interroger l’assistant IA...'
            }
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            onKeyDown={(e) => isOnline && e.key === 'Enter' && handleAskAssistant()}
            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
          />
          <button
            onClick={() => handleAskAssistant()}
            disabled={loading || !isOnline}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Interroger</span>
          </button>
        </div>
      </div>

      {/* Response Box */}
      {response && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-2xl space-y-4 animate-fade-in">
          <FormattedAIResponse
            content={response}
            groundingMetadata={groundingMetadata}
          />
        </div>
      )}
    </div>
  );
};
