import { GoogleGenAI } from '@google/genai';

interface AssistantPayload {
  prompt?: string;
  latitude?: number;
  longitude?: number;
  partnerName?: string;
  category?: string;
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: AssistantPayload = await req.json().catch(() => ({}));
    const { prompt, latitude, longitude, partnerName, category } = body;
    const currentApiKey = process.env.GEMINI_API_KEY;

    if (!currentApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          fallback: true,
          message:
            'Clé GEMINI_API_KEY non configurée sur Netlify. Pour activer l’analyse en temps réel par satellite et cartographie, ajoutez GEMINI_API_KEY dans les variables d’environnement de votre site Netlify.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const contextPrompt = `Tu es un assistant expert en cartographie de terrain et déploiement d'agents de partenariat.
Coordonnées GPS de l'agent: Latitude ${latitude}, Longitude ${longitude}.
Partenaire ciblé: ${partnerName || 'Non spécifié'}
Catégorie: ${category || 'Général'}
Demande de l'agent: ${prompt || "Analyse la zone autour de ces coordonnées GPS, identifie les points de repère notables, l'accessibilité routière et des conseils pour l'agent sur place."}

Consignes de rédaction :
- Rédige en français professionnel, précis et chaleureux.
- Structure ta réponse avec des sections claires (ex: 📍 Repères clés & Environnement, 🚗 Accessibilité & Déplacement, 📋 Conseils opérationnels pour l'agent).
- Utilise des listes à puces aérées et percutantes.
- Évite les symboles superflus ou le code brut.`;

    const ai = new GoogleGenAI({
      apiKey: currentApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // 1. Try with Google Maps grounding tool
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: contextPrompt,
        config: {
          tools: [{ googleMaps: {} }],
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          text: response.text,
          groundingMetadata: response.candidates?.[0]?.groundingMetadata || null,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (_groundingError) {
      // 2. Fallback: Direct Gemini 3.8 Flash generation
      const directResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: contextPrompt,
      });

      return new Response(
        JSON.stringify({
          success: true,
          text: directResponse.text,
          groundingMetadata: null,
          fallbackMode: true,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Erreur lors de la génération',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
