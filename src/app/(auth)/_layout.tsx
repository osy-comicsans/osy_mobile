import { Stack } from 'expo-router';

import { FullScreenLoader } from '@/common/components/ui/loading';
import { useAccount } from '@/features/auth/hooks/useAccount';

export default function AuthLayout() {
  const { phase } = useAccount();

  // Account document checks may outlast the bounded native startup gate.
  // Keep a usable screen and emergency action while that work completes.
  if (phase === 'loading') return <FullScreenLoader />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={phase === 'signedOut'}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'onboarding'}>
        <Stack.Screen name="documents" />
        <Stack.Screen name="document-source" />
        <Stack.Screen name="document-review" />
      </Stack.Protected>
    </Stack>
  );
}
