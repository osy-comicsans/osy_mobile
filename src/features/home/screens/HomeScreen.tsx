import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/common/components/animated-icon';
import { HintRow } from '@/common/components/hint-row';
import { AmbientBackground } from '@/common/components/ui/ambient-background';
import { Card } from '@/common/components/ui/card';
import { ThemedText } from '@/common/components/themed-text';
import { WebBadge } from '@/common/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/common/lib/theme';
import { getDeveloperMenuHint } from '@/common/lib/native/device';

export function HomeScreen() {
  return (
    <View style={styles.container}>
      <AmbientBackground />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="display" style={styles.title}>
            Welcome to&nbsp;OSY
          </ThemedText>
        </View>

        <ThemedText type="overline" themeColor="textTertiary">
          get started
        </ThemedText>

        <Card tone="muted" style={styles.stepContainer}>
          <HintRow
            title="Try editing"
            hint={<ThemedText type="code">HomeScreen.tsx</ThemedText>}
          />
          <HintRow
            title="Dev tools"
            hint={<ThemedText type="small">{getDeveloperMenuHint()}</ThemedText>}
          />
          <HintRow
            title="Fresh start"
            hint={<ThemedText type="code">npm run reset-project</ThemedText>}
          />
        </Card>

        {Platform.OS === 'web' && <WebBadge />}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
});
