import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor, Typography } from '@/common/lib/theme';
import { useTheme } from '@/common/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'display'
    | 'heading'
    | 'headingS'
    | 'body'
    | 'bodyMedium'
    | 'label'
    | 'overline';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        type === 'display' && styles.display,
        type === 'heading' && styles.heading,
        type === 'headingS' && styles.headingS,
        type === 'body' && styles.body,
        type === 'bodyMedium' && styles.bodyMedium,
        type === 'label' && styles.label,
        type === 'overline' && styles.overline,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: Typography.body,
  small: Typography.label,
  smallBold: { ...Typography.label, fontFamily: Typography.labelMedium.fontFamily },
  title: Typography.displayS,
  subtitle: Typography.headingL,
  display: Typography.displayM,
  heading: Typography.headingM,
  headingS: Typography.headingS,
  body: Typography.body,
  bodyMedium: Typography.bodyMedium,
  label: Typography.label,
  overline: Typography.overline,
  link: { ...Typography.bodyMedium, color: '#6316DB' },
  linkPrimary: { ...Typography.bodyMedium, color: '#6316DB' },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
