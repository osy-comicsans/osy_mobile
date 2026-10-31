import AppTabs from '@/common/components/app-tabs';
import { RiskWarningMonitor } from '@/features/road-risk/components/RiskWarningMonitor';
import { RoadRiskProvider } from '@/features/road-risk/providers/RoadRiskProvider';
import { NearbyIncidentMonitor } from '@/features/safety/components/NearbyIncidentMonitor';

export default function TabsLayout() {
  return (
    <RoadRiskProvider>
      <RiskWarningMonitor />
      <NearbyIncidentMonitor />
      <AppTabs />
    </RoadRiskProvider>
  );
}
