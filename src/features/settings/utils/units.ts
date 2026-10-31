export const speedValue = (kmh: number, units: 'kmh' | 'mph') => units === 'mph' ? kmh / 1.609344 : kmh;
export const distanceValue = (meters: number, units: 'kmh' | 'mph') => meters / (units === 'mph' ? 1609.344 : 1000);
