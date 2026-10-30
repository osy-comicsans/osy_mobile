import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';

export function MapScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('map.title')}
      description={t('map.description')}
    />
  );
}
