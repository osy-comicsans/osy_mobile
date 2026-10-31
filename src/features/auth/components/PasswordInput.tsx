import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/common/components/ui/icon';
import { Input, type InputProps } from '@/common/components/ui/input';
import { Colors, Radius } from '@/common/lib/theme';

export function PasswordInput(props: InputProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      trailing={(
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(visible ? 'auth.hidePassword' : 'auth.showPassword')}
          onPress={() => setVisible(!visible)}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
          <Icon name={visible ? 'hide' : 'show'} size={20} color={Colors.textSecondary} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  toggle: { width: 44, height: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: Colors.backgroundElement },
});
