/**
 * debateModels.js
 * Curated list of AI models supported by the Solo Arena debate feature.
 * Gemini models require GOOGLE_API_KEY; Claude models require ANTHROPIC_API_KEY.
 */
export const DEBATE_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google' },
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', provider: 'Anthropic' },
  { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus', provider: 'Anthropic' },
];
