import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export const unstable_settings = {
  anchor: 'index',
};

export default function ProfileLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: t('profile.title') }} />
      <Stack.Screen name="edit" options={{ title: t('account.details') }} />
      <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
      <Stack.Screen name="licenses" options={{ title: t('preferences.licenses') }} />
      <Stack.Screen name="emergency-contacts" options={{ title: t('profile.emergencyContacts') }} />
    </Stack>
  );
}
