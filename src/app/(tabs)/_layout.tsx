import AppTabs from '@/common/components/app-tabs';
import { RiskWarningMonitor } from '@/features/road-risk/components/RiskWarningMonitor';
import { NearbyIncidentMonitor } from '@/features/safety/components/NearbyIncidentMonitor';

export default function TabsLayout() {
  return (
    <>
      <RiskWarningMonitor />
      <NearbyIncidentMonitor />
      <AppTabs />
    </>
  );
}
