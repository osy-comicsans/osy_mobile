import AppTabs from '@/common/components/app-tabs';
import { RiskWarningMonitor } from '@/features/road-risk/components/RiskWarningMonitor';

export default function TabsLayout() {
  return (
    <>
      <RiskWarningMonitor />
      <AppTabs />
    </>
  );
}
