import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/common/components/ui/button';
import { Input } from '@/common/components/ui/input';

import { authApi } from '../authServices';
import { AuthScreen } from '../components/AuthScreen';
import { EmergencyAccess } from '../components/EmergencyAccess';
import { FormNotice } from '../components/FormNotice';
import { LabelDivider } from '../components/LabelDivider';
import { PasswordInput } from '../components/PasswordInput';
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
    <AuthScreen
      title={t('auth.loginTitle')}
      description={t('auth.loginDescription')}
      logo
      showBack
      onBack={() => router.dismissTo('/welcome')}
      footer={<EmergencyAccess variant="link" />}>
      {formError && (
        <FormNotice
          message={text(formError)}
          detail={formError === 'auth.errors.invalidCredentials' ? t('auth.errors.invalidCredentialsHint') : undefined}
        />
      )}
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
      <PasswordInput
        label={t('auth.password')}
        value={values.password}
        onChangeText={(password) => setValues((current) => ({ ...current, password }))}
        error={error('password')}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
      />
      <Button label={t('auth.signIn')} size="large" loading={submitting} onPress={() => void submit()} />
      <LabelDivider label={t('auth.noAccount')} />
      <Button label={t('auth.createAccount')} variant="tonal" size="large" onPress={() => router.push('/register')} />
    </AuthScreen>
  );
}
