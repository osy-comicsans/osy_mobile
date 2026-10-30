import { Button } from '@/common/components/ui/button';
import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';

import { useDismissModal } from '../hooks/useDismissModal';

export function AlertDetailScreen() {
  const dismiss = useDismissModal();

  return (
    <PlaceholderScreen title="Alert" description="Alert details will appear here.">
      <Button label="Dismiss" variant="secondary" onPress={dismiss} />
    </PlaceholderScreen>
  );
}
