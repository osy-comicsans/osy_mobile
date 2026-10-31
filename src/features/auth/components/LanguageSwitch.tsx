import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/common/components/ui/icon';
import { useTheme } from '@/common/hooks/use-theme';
import { setLanguagePreference } from '@/common/lib/i18n/i18n';
import { LANGUAGE_NAMES, LANGUAGES, isRtl } from '@/common/lib/i18n/languages';
import { ArabicFontFamily } from '@/common/lib/tokens';
import { Colors, Palette, Radius, Space, Typography } from '@/common/lib/theme';

// Each language is written in its own name, so it can be found before the app is readable.
export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Icon name="globe" size={20} color={theme.textSecondary} />
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('settings.language')}
        style={[styles.options, { backgroundColor: theme.backgroundElement }]}>
        {LANGUAGES.map((language) => {
          const active = i18n.language === language;
          return (
            <Pressable
              key={language}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => setLanguagePreference(language)}
              style={({ pressed }) => [styles.option, active ? styles.active : pressed && styles.pressed]}>
              <Text
                numberOfLines={1}
                style={[
                  active ? styles.activeText : styles.text,
                  isRtl(language) && { fontFamily: active ? ArabicFontFamily.semiBold : ArabicFontFamily.medium },
                ]}>
                {LANGUAGE_NAMES[language]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  options: { flex: 1, flexDirection: 'row', gap: Space[1], padding: Space[1], borderRadius: Radius.full },
  option: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full },
  active: { backgroundColor: Colors.accent },
  pressed: { backgroundColor: Colors.accentSoft },
  text: { ...Typography.bodyMedium, color: Palette.neutral[600] },
  activeText: { ...Typography.buttonMedium, color: Colors.onAccent },
});
