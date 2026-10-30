import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Card } from '@/common/components/ui/card';
import { getLanguagePreference, setLanguagePreference } from '@/common/lib/i18n/i18n';
import { LANGUAGE_NAMES, LANGUAGES, type LanguagePreference } from '@/common/lib/i18n/languages';
import { Colors, Space } from '@/common/lib/theme';

export function LanguageSetting() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(getLanguagePreference);

  const select = (preference: LanguagePreference) => {
    setSelected(preference);
    setLanguagePreference(preference);
  };

  const options: { value: LanguagePreference; label: string }[] = [
    { value: 'system', label: t('settings.systemLanguage') },
    ...LANGUAGES.map((value) => ({ value, label: LANGUAGE_NAMES[value] })),
  ];

  return (
    <Card style={styles.card}>
      <ThemedText type="headingS" accessibilityRole="header">{t('settings.language')}</ThemedText>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.language')}>
        {options.map(({ value, label }) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected === value }}
            onPress={() => select(value)}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
            <ThemedText type="bodyMedium" style={styles.label}>{label}</ThemedText>
            {selected === value && <ThemedText type="bodyMedium" themeColor="accent">✓</ThemedText>}
          </Pressable>
        ))}
      </View>
      <ThemedText type="label" themeColor="textSecondary">{t('settings.restartHint')}</ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', gap: Space[2] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    minHeight: 44,
    paddingVertical: Space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  label: { flex: 1 },
  pressed: { opacity: 0.7 },
});
