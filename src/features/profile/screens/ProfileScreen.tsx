import { router } from 'expo-router';

import { Button } from '@/common/components/ui/button';
import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';

export function ProfileScreen() {
  return (
    <PlaceholderScreen
      title="Profile"
      description="Your details, emergency contacts, and driving stats will appear here.">
      <Button label="Settings" variant="secondary" onPress={() => router.push('/profile/settings')} />
    </PlaceholderScreen>
  );
}
