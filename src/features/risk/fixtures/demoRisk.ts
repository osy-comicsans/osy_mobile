import type { RiskAssessment } from '../types/risk.types';

// Presentation fixture only. Never consume this as live telemetry, a crash
// probability, an alert trigger, or an explanation of the live weather.
export const demoRiskAssessment: RiskAssessment = Object.freeze({
  source: 'placeholder', level: 'moderate', score: 42, updatedAt: null,
  factors: Object.freeze([
    Object.freeze({ id: 'wet-surface', labelKey: 'dashboard.risk.factorWet' }),
    Object.freeze({ id: 'visibility', labelKey: 'dashboard.risk.factorVisibility' }),
  ]),
});
