export type DetectionSensitivity = 'low' | 'standard' | 'high';
export const sensitivityPolicy = (value: DetectionSensitivity) => ({
  low: { impactG: 4.8, confidence: 0.85, modelThreshold: 0.65 },
  standard: { impactG: 4, confidence: 0.8, modelThreshold: 0.5 },
  high: { impactG: 3.5, confidence: 0.75, modelThreshold: 0.4 },
})[value];
