import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, type TextInputProps } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Input, type InputHandle } from '@/common/components/ui/input';
import { Space } from '@/common/lib/theme';

import { authApi } from '../authServices';
import { AuthScreen } from '../components/AuthScreen';
import { useFormErrors } from '../hooks/useFormErrors';
import { useKeyText } from '../hooks/useKeyText';
import { registerFormSchema } from '../types/auth.schemas';
import { mapRegisterError } from '../utils/authForm';

const FIELDS = ['firstName', 'lastName', 'email', 'mobileNumber', 'password', 'confirmPassword'] as const;
type Field = (typeof FIELDS)[number];

const inputProps: Record<Field, TextInputProps> = {
  firstName: { autoComplete: 'given-name', textContentType: 'givenName' },
  lastName: { autoComplete: 'family-name', textContentType: 'familyName' },
  email: { autoCapitalize: 'none', autoComplete: 'email', keyboardType: 'email-address', textContentType: 'emailAddress' },
  mobileNumber: { autoComplete: 'tel', keyboardType: 'phone-pad', textContentType: 'telephoneNumber' },
  password: { secureTextEntry: true, autoComplete: 'new-password', textContentType: 'newPassword' },
  confirmPassword: { secureTextEntry: true, autoComplete: 'new-password', textContentType: 'newPassword' },
};

export function RegisterScreen() {
  const { t } = useTranslation();
  const text = useKeyText();
  const [values, setValues] = useState<Record<Field, string>>({
    firstName: '', lastName: '', email: '', mobileNumber: '+213', password: '', confirmPassword: '',
  });
  const [serverErrors, setServerErrors] = useState<Partial<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputs = useRef<Partial<Record<Field, InputHandle | null>>>({});
  const form = useFormErrors(registerFormSchema, values);

  const change = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setServerErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async () => {
    if (submitting) return;
    form.touchAll();
    const firstInvalid = FIELDS.find((field) => form.errors[field]);
    if (firstInvalid) {
      inputs.current[firstInvalid]?.focus();
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const { confirmPassword: _confirmPassword, ...request } = registerFormSchema.parse(values);
      await authApi.register(request);
    } catch (error) {
      const { fieldKeys, fieldText, formKey } = mapRegisterError(error);
      const translated = Object.fromEntries(Object.entries(fieldKeys).map(([field, key]) => [field, text(key)]));
      setServerErrors({ ...translated, ...fieldText });
      setFormError(formKey);
      setSubmitting(false);
    }
  };

  const error = (field: Field) => {
    const key = form.errorFor(field);
    return key ? text(key) : serverErrors[field];
  };

  return (
    <AuthScreen title={t('auth.registerTitle')} description={t('auth.registerDescription')}>
      {FIELDS.map((field, index) => (
        <Input
          key={field}
          ref={(input) => { inputs.current[field] = input; }}
          label={t(`auth.${field}`)}
          value={values[field]}
          onChangeText={(value) => change(field, value)}
          onBlur={() => form.touch(field)}
          error={error(field)}
          returnKeyType={index === FIELDS.length - 1 ? 'done' : 'next'}
          onSubmitEditing={() => {
            if (index === FIELDS.length - 1) void submit();
            else inputs.current[FIELDS[index + 1]]?.focus();
          }}
          {...inputProps[field]}
        />
      ))}
      {formError && (
        <ThemedText type="label" themeColor="errorText" accessibilityRole="alert">{text(formError)}</ThemedText>
      )}
      <Button
        label={t('auth.createAccount')}
        size="large"
        loading={submitting}
        onPress={() => void submit()}
        style={styles.action}
      />
      <Button label={t('auth.haveAccount')} variant="text" onPress={() => router.back()} style={styles.action} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  action: { alignSelf: 'stretch', marginTop: Space[1] },
});
