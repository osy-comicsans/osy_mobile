import { demoRiskAssessment } from '../fixtures/demoRisk';

// Replace this adapter when the risk-model issue lands; Home consumes only
// the assessment contract and does not implement a second scoring model.
export function useRiskAssessment() { return demoRiskAssessment; }
