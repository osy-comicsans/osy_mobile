import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Input } from '@/common/components/ui/input';
import { Space } from '@/common/lib/theme';

import { authApi } from '../authServices';
import { AuthScreen } from '../components/AuthScreen';
import { useFormErrors } from '../hooks/useFormErrors';
import { useKeyText } from '../hooks/useKeyText';
import { loginFormSchema } from '../types/auth.schemas';
import { loginErrorKey } from '../utils/authForm';

export function LoginScreen() {
  const { t } = useTranslation();
  const text = useKeyText();
  const [values, setValues] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useFormErrors(loginFormSchema, values);

  const submit = async () => {
    if (submitting) return;
    form.touchAll();
    if (Object.keys(form.errors).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await authApi.login(loginFormSchema.parse(values));
    } catch (error) {
      setFormError(loginErrorKey(error));
      setSubmitting(false);
    }
  };

  const error = (field: 'email' | 'password') => {
    const key = form.errorFor(field);
    return key ? text(key) : undefined;
  };

  return (
    <AuthScreen title={t('auth.loginTitle')} description={t('auth.loginDescription')}>
      <Input
        label={t('auth.email')}
        value={values.email}
        onChangeText={(email) => setValues((current) => ({ ...current, email }))}
        error={error('email')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="next"
      />
      <Input
        label={t('auth.password')}
        value={values.password}
        onChangeText={(password) => setValues((current) => ({ ...current, password }))}
        error={error('password')}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
      />
      {formError && (
        <ThemedText type="label" themeColor="errorText" accessibilityRole="alert">{text(formError)}</ThemedText>
      )}
      <Button label={t('auth.signIn')} size="large" loading={submitting} onPress={() => void submit()} style={styles.action} />
      <Button label={t('auth.createAccount')} variant="text" onPress={() => router.push('/register')} style={styles.action} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  action: { alignSelf: 'stretch', marginTop: Space[1] },
});
