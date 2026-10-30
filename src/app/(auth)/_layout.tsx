import { Stack } from 'expo-router';

import { useAccount } from '@/features/auth/hooks/useAccount';

export default function AuthLayout() {
  const { phase } = useAccount();

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
