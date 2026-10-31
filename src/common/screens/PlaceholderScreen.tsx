import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { MaxContentWidth, Spacing } from '@/common/lib/theme';

type PlaceholderScreenProps = PropsWithChildren<{
  title: string;
  description: string;
}>;

export function PlaceholderScreen({ title, description, children }: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <ThemedText type="heading" style={styles.text}>
        {title}
      </ThemedText>
      <ThemedText type="body" themeColor="textSecondary" style={styles.text}>
        {description}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  text: {
    maxWidth: MaxContentWidth,
    textAlign: 'center',
  },
});
