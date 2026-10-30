import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';
import { LiveLocationCard } from '@/features/location/components/LiveLocationCard';
import { LocationPermissionCard } from '@/features/location/components/LocationPermissionCard';

export function HomeScreen() {
  return (
    <PlaceholderScreen
      title="Home"
      description="Your location, speed, accident risk, and weather will appear here.">
      <LocationPermissionCard />
      <LiveLocationCard />
    </PlaceholderScreen>
  );
}
