import { Button } from '@/common/components/ui/button';
import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';

import { useDismissModal } from '../hooks/useDismissModal';

export function CheckInScreen() {
  const dismiss = useDismissModal();

  return (
    <PlaceholderScreen
      title="Are you OK?"
      description="The emergency check-in will appear here.">
      <Button label="Dismiss" variant="secondary" onPress={dismiss} />
    </PlaceholderScreen>
  );
}
