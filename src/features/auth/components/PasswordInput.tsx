import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/common/components/ui/icon';
import { Input, type InputProps } from '@/common/components/ui/input';
import { Colors } from '@/common/lib/theme';

export function PasswordInput(props: InputProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      leadingIcon={<Icon name="lock" size={18} />}
      trailing={(
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(visible ? 'auth.hidePassword' : 'auth.showPassword')}
          hitSlop={6}
          onPress={() => setVisible(!visible)}
          style={styles.toggle}>
          <Icon name={visible ? 'hide' : 'show'} size={18} color={Colors.textTertiary} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  toggle: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
