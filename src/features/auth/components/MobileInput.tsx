import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Input, type InputProps } from '@/common/components/ui/input';
import { useTheme } from '@/common/hooks/use-theme';
import { Colors, Radius, Space, Typography } from '@/common/lib/theme';

import { formatMobileDigits, nationalMobileDigits } from '../utils/authForm';

const COUNTRY_CODE = '+213';

// Shows the national digits after a fixed +213, spaced as 555 12 34 56.
// The value stays in +213555123456 form.
export function MobileInput({ value = '', onChangeText, ...props }: InputProps) {
  const theme = useTheme();

  return (
    <Input
      {...props}
      value={formatMobileDigits(nationalMobileDigits(value.replace(/^\+213/, '')))}
      onChangeText={(text) => onChangeText?.(`${COUNTRY_CODE}${nationalMobileDigits(text)}`)}
      keyboardType="phone-pad"
      autoComplete="tel-national"
      textContentType="telephoneNumber"
      style={styles.number}
      leading={(
        <View style={[styles.code, { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong }]}>
          <Image source={require('@/assets/images/flag-dz.svg')} contentFit="contain" transition={0}
            accessible={false} style={styles.flag} />
          <Text style={[styles.codeText, { color: theme.textPrimary }]}>{COUNTRY_CODE}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: Space[2],
    paddingStart: Space[4],
    paddingEnd: Space[3],
    borderEndWidth: 1,
    borderTopStartRadius: Radius.md - 1,
    borderBottomStartRadius: Radius.md - 1,
  },
  flag: { width: 24, height: 16 },
  codeText: { ...Typography.buttonLarge, color: Colors.textPrimary },
  number: { letterSpacing: 0.4 },
});
