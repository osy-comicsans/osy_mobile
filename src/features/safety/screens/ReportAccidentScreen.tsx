import { Button } from '@/common/components/ui/button';
import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';

import { useDismissModal } from '../hooks/useDismissModal';

export function ReportAccidentScreen() {
  const dismiss = useDismissModal();

  return (
    <PlaceholderScreen
      title="Report an accident"
      description="The accident report form will appear here.">
      <Button label="Dismiss" variant="secondary" onPress={dismiss} />
    </PlaceholderScreen>
  );
}
