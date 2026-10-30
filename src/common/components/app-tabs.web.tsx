import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable, View, StyleSheet } from 'react-native';

import { ExternalLink } from './external-link';
import { ThemedText } from './themed-text';

import { Colors, MaxContentWidth, Radius, Shadow, Spacing } from '@/common/lib/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="todos" href="/todos" asChild>
            <TabButton>Tasks</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>Explore</TabButton>
          </TabTrigger>
          <TabTrigger name="device-playground" href="/device-playground" asChild>
            <TabButton>Device Lab</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ref, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable
      {...props}
      // expo-router types this ref as RefAttributes<View>, which no longer matches Pressable's instance ref under RN 0.88's strict types.
      ref={ref as React.ComponentProps<typeof Pressable>['ref']}
      style={({ pressed }) => pressed && styles.pressed}>
      <View style={[styles.tabButtonView, isFocused ? styles.tabActive : styles.tabInactive]}>
        <ThemedText
          type="bodyMedium"
          style={isFocused ? styles.tabActiveLabel : styles.tabInactiveLabel}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>
        <ThemedText type="headingS" style={styles.brandText}>
          OSY
        </ThemedText>

        {props.children}

        <ExternalLink href="https://docs.expo.dev" asChild>
          <Pressable style={styles.externalPressable}>
            <ThemedText type="link">Docs</ThemedText>
            <SymbolView
              tintColor={Colors.accent}
              name={{ ios: 'arrow.up.right.square', web: 'link' }}
              size={12}
            />
          </Pressable>
        </ExternalLink>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    boxShadow: Shadow.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    flexWrap: 'wrap',
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
    color: Colors.textPrimary,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
  },
  tabActive: { backgroundColor: Colors.accent },
  tabInactive: { backgroundColor: Colors.accentSoft },
  tabActiveLabel: { color: Colors.onAccent },
  tabInactiveLabel: { color: Colors.textSecondary },
  externalPressable: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    marginLeft: Spacing.three,
  },
});
