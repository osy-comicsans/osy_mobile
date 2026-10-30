import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Icon, type IconName } from '@/common/components/ui/icon';
import { Input, type InputHandle } from '@/common/components/ui/input';
import { Space } from '@/common/lib/theme';

import { authApi } from '../authServices';
import { AuthScreen, sheetCard } from '../components/AuthScreen';
import { FormNotice } from '../components/FormNotice';
import { PasswordInput } from '../components/PasswordInput';
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
  password: { autoComplete: 'new-password', textContentType: 'newPassword' },
  confirmPassword: { autoComplete: 'new-password', textContentType: 'newPassword' },
};

const hints = { mobileNumber: 'auth.mobileHint', password: 'auth.passwordHint' } as const satisfies Partial<Record<Field, string>>;
const icons: Partial<Record<Field, IconName>> = { email: 'mail', mobileNumber: 'phone' };

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
    <AuthScreen
      title={t('auth.registerTitle')}
      description={t('auth.registerDescription')}
      overline={t('auth.stepOne')}
      showBack
      footer={(
        <>
          <ThemedText type="body" themeColor="textSecondary">{t('auth.haveAccount')}</ThemedText>
          <Button label={t('auth.signIn')} variant="text" size="small" onPress={() => router.back()} />
        </>
      )}>
      <View style={sheetCard}>
        {formError && <FormNotice message={text(formError)} />}
        <View style={styles.fields}>
          {FIELDS.map((name, index) => {
            const Field = name === 'password' || name === 'confirmPassword' ? PasswordInput : Input;
            const last = index === FIELDS.length - 1;
            const iconName = icons[name];
            return (
              <Field
                key={name}
                ref={(input: InputHandle | null) => { inputs.current[name] = input; }}
                label={t(`auth.${name}`)}
                hint={name in hints ? t(hints[name as keyof typeof hints]) : undefined}
                value={values[name]}
                onChangeText={(value) => change(name, value)}
                onBlur={() => form.touch(name)}
                error={error(name)}
                returnKeyType={last ? 'done' : 'next'}
                onSubmitEditing={() => {
                  if (last) void submit();
                  else inputs.current[FIELDS[index + 1]]?.focus();
                }}
                containerStyle={name === 'firstName' || name === 'lastName' ? styles.name : styles.wide}
                leadingIcon={iconName && <Icon name={iconName} size={18} />}
                {...inputProps[name]}
              />
            );
          })}
        </View>
        <Button label={t('auth.createAccount')} size="large" loading={submitting} onPress={() => void submit()} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[5] },
  name: { flex: 1, minWidth: 130 },
  wide: { width: '100%' },
});
