import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, StyleSheet, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Icon } from '@/common/components/ui/icon';
import { Input, type InputHandle, type InputProps } from '@/common/components/ui/input';
import { useTheme } from '@/common/hooks/use-theme';
import { Colors, Radius, Space, Typography } from '@/common/lib/theme';

import { accountService, authApi } from '../authServices';
import { AuthScreen } from '../components/AuthScreen';
import { FormNotice } from '../components/FormNotice';
import { MobileInput } from '../components/MobileInput';
import { PasswordInput } from '../components/PasswordInput';
import { useFormErrors } from '../hooks/useFormErrors';
import { useKeyText } from '../hooks/useKeyText';
import { registerFormSchema } from '../types/auth.schemas';
import { mapRegisterError, passwordRules } from '../utils/authForm';

// Sign-up asks for the person first, then for how they will sign in.
const DETAIL_FIELDS = ['firstName', 'lastName', 'mobileNumber'] as const;
const SIGN_IN_FIELDS = ['email', 'password'] as const;
const FIELDS = [...DETAIL_FIELDS, ...SIGN_IN_FIELDS];
type Field = (typeof FIELDS)[number];

const isDetail = (field: string) => (DETAIL_FIELDS as readonly string[]).includes(field);

const inputProps: Record<Exclude<Field, 'mobileNumber'>, TextInputProps> = {
  firstName: { autoComplete: 'given-name', textContentType: 'givenName' },
  lastName: { autoComplete: 'family-name', textContentType: 'familyName' },
  email: { autoCapitalize: 'none', autoComplete: 'email', keyboardType: 'email-address', textContentType: 'emailAddress' },
  password: { autoComplete: 'new-password', textContentType: 'newPassword' },
};

const RULES = [
  { key: 'length', label: 'auth.passwordRules.length' },
  { key: 'letterCase', label: 'auth.passwordRules.letterCase' },
  { key: 'number', label: 'auth.passwordRules.number' },
] as const;

function PasswordRules({ password }: { password: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const met = passwordRules(password);

  return (
    <View style={styles.rules}>
      {RULES.map(({ key, label }) => (
        <View key={key} accessible accessibilityLabel={t(label)} accessibilityState={{ checked: met[key] }} style={styles.rule}>
          <View style={styles.mark}>
            {met[key]
              ? <Icon name="check" size={16} color={Colors.successText} />
              : <View style={[styles.unmet, { borderColor: theme.textTertiary }]} />}
          </View>
          <ThemedText type="body" themeColor={met[key] ? 'textPrimary' : 'textSecondary'}>{t(label)}</ThemedText>
        </View>
      ))}
    </View>
  );
}

export function RegisterScreen() {
  const { t } = useTranslation();
  const text = useKeyText();
  const theme = useTheme();
  const [step, setStep] = useState<'details' | 'signIn'>('details');
  const [values, setValues] = useState<Record<Field, string>>({
    firstName: '', lastName: '', mobileNumber: '+213', email: '', password: '',
  });
  const [serverErrors, setServerErrors] = useState<Partial<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputs = useRef<Partial<Record<Field, InputHandle | null>>>({});
  const form = useFormErrors(registerFormSchema, values);

  // Android's back button returns to the first step, as the header's does.
  useEffect(() => {
    if (step === 'details') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep('details');
      return true;
    });
    return () => subscription.remove();
  }, [step]);

  const change = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setServerErrors((current) => ({ ...current, [field]: undefined }));
  };

  const focus = (field: Field) => inputs.current[field]?.focus();

  const next = () => {
    DETAIL_FIELDS.forEach((field) => form.touch(field));
    const firstInvalid = DETAIL_FIELDS.find((field) => form.errors[field]);
    if (firstInvalid) focus(firstInvalid);
    else setStep('signIn');
  };

  const submit = async () => {
    if (submitting) return;
    form.touchAll();
    const firstInvalid = FIELDS.find((field) => form.errors[field]);
    if (firstInvalid) {
      if (isDetail(firstInvalid)) setStep('details');
      else focus(firstInvalid);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      accountService.beginSignUp();
      await authApi.register(registerFormSchema.parse(values));
    } catch (error) {
      accountService.cancelSignUp();
      const { fieldKeys, fieldText, formKey } = mapRegisterError(error);
      const translated = Object.fromEntries(Object.entries(fieldKeys).map(([field, key]) => [field, text(key)]));
      const errors = { ...translated, ...fieldText };
      setServerErrors(errors);
      setFormError(formKey);
      setSubmitting(false);
      if (Object.keys(errors).some(isDetail)) setStep('details');
    }
  };

  const fieldProps = (name: Field): InputProps => {
    const key = form.errorFor(name);
    return {
      label: t(`auth.${name}`),
      value: values[name],
      onChangeText: (value: string) => change(name, value),
      onBlur: () => form.touch(name),
      error: key ? text(key) : serverErrors[name],
    };
  };

  const details = step === 'details';

  return (
    <AuthScreen
      title={t(details ? 'auth.registerTitle' : 'auth.secureTitle')}
      description={t(details ? 'auth.registerDescription' : 'auth.secureDescription')}
      progress={{ step: 0, fill: details ? 0.5 : 1 }}
      showBack
      onBack={() => {
        if (!details) setStep('details');
        else if (router.canGoBack()) router.back();
        else router.replace('/welcome');
      }}
      footer={(
        <>
          {details ? (
            <Button
              label={t('auth.continue')}
              size="large"
              rightIcon={<Icon name="forward" size={18} color={Colors.onAccent} />}
              onPress={next}
            />
          ) : (
            <Button label={t('auth.createAccount')} size="large" loading={submitting} onPress={() => void submit()} />
          )}
          <View style={styles.switch}>
            <ThemedText type="body" themeColor="textSecondary">{t('auth.haveAccount')}</ThemedText>
            <Pressable accessibilityRole="link" hitSlop={12} onPress={() => router.dismissTo('/login')}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText style={[Typography.bodyStrong, { color: theme.accent }]}>{t('auth.signIn')}</ThemedText>
            </Pressable>
          </View>
        </>
      )}>
      {formError && <FormNotice message={text(formError)} />}
      {details ? (
        <>
          <View style={styles.names}>
            <Input
              {...fieldProps('firstName')}
              {...inputProps.firstName}
              ref={(input) => { inputs.current.firstName = input; }}
              returnKeyType="next"
              onSubmitEditing={() => focus('lastName')}
              containerStyle={styles.name}
            />
            <Input
              {...fieldProps('lastName')}
              {...inputProps.lastName}
              ref={(input) => { inputs.current.lastName = input; }}
              returnKeyType="next"
              onSubmitEditing={() => focus('mobileNumber')}
              containerStyle={styles.name}
            />
          </View>
          <MobileInput
            {...fieldProps('mobileNumber')}
            ref={(input) => { inputs.current.mobileNumber = input; }}
            returnKeyType="done"
            onSubmitEditing={next}
          />
        </>
      ) : (
        <>
          <Input
            {...fieldProps('email')}
            {...inputProps.email}
            ref={(input) => { inputs.current.email = input; }}
            returnKeyType="next"
            onSubmitEditing={() => focus('password')}
            valid={!!values.email && !form.errors.email && !serverErrors.email}
          />
          <View style={styles.password}>
            <PasswordInput
              {...fieldProps('password')}
              {...inputProps.password}
              ref={(input) => { inputs.current.password = input; }}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
            />
            <PasswordRules password={values.password} />
          </View>
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  names: { flexDirection: 'row', gap: Space[3] },
  name: { flex: 1 },
  password: { gap: Space[3] },
  rules: { gap: Space[2] },
  rule: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  mark: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  unmet: { width: 14, height: 14, borderRadius: Radius.full, borderWidth: 1.5 },
  switch: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Space[1] },
  pressed: { opacity: 0.6 },
});
