import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';
import { AlertPermissionCard } from '@/features/alerts/components/AlertPermissionCard';
import { LiveLocationCard } from '@/features/location/components/LiveLocationCard';
import { LocationPermissionCard } from '@/features/location/components/LocationPermissionCard';
import { WeatherWidget } from '@/features/weather/components/WeatherWidget';

export function HomeScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('home.title')}
      description={t('home.description')}>
      <LocationPermissionCard />
      <AlertPermissionCard />
      <LiveLocationCard />
      <WeatherWidget />
    </PlaceholderScreen>
  );
}
