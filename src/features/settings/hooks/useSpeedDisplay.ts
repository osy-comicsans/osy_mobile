import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { useSettings } from './useSettings';
import { speedValue } from '../utils/units';

export function useSpeedDisplay(kmh: number | null) {
  const { t } = useTranslation(); const { settings } = useSettings();
  const value = kmh === null ? null : speedValue(kmh, settings.units);
  const formatted = value === null ? '—' : formatNumber(getLanguage(), Math.round(value));
  const unit = t(settings.units === 'mph' ? 'preferences.mph' : 'units.kmh');
  return { value, formatted, unit, units: settings.units,
    spoken: value === null ? t('units.speedUnknown') : t('preferences.spokenSpeed', { value: formatted, unit }) };
}
