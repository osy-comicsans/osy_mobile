export interface RiskAssessment {
  source: 'placeholder' | 'model';
  level: 'low' | 'moderate' | 'high' | 'unknown';
  score: number | null;
  factors: readonly { id: string; labelKey: string }[];
  updatedAt: number | null;
}
