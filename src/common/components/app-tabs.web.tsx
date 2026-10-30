import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';

import { Colors, MaxContentWidth, Radius, Shadow, Spacing } from '@/common/lib/theme';

export default function AppTabs() {
  const { t } = useTranslation();

  return (
    <Tabs>
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>{t('tabs.home')}</TabButton>
          </TabTrigger>
          <TabTrigger name="map" href="/map" asChild>
            <TabButton>{t('tabs.map')}</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton>{t('tabs.profile')}</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
      <TabSlot style={{ flex: 1 }} />
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
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
    marginEnd: 'auto',
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
});
