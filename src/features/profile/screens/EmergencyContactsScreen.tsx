import { randomUUID } from 'expo-crypto';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Input } from '@/common/components/ui/input';
import { Colors, Space } from '@/common/lib/theme';
import { profileApi } from '@/features/auth/authServices';

import { emergencyContactSchema, type EmergencyContact } from '../types/profile.schemas';

export function EmergencyContactsScreen() {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('+213');
  const [failed, setFailed] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    profileApi.getEmergencyContacts()
      .then((response) => { if (active) setContacts(response.contacts); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const save = async (next: EmergencyContact[]) => {
    setSaving(true);
    setFailed(false);
    try {
      setContacts((await profileApi.replaceEmergencyContacts(next)).contacts);
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    const parsed = emergencyContactSchema.safeParse({ id: randomUUID(), name, mobileNumber, relationship: null });
    setInvalid(!parsed.success);
    if (!parsed.success) return;
    if (await save([...contacts, parsed.data])) {
      setName('');
      setMobileNumber('+213');
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <ThemedText themeColor="textSecondary">{t('contacts.description')}</ThemedText>
      {failed && <ThemedText type="label" themeColor="errorText" accessibilityRole="alert">{t('contacts.failed')}</ThemedText>}

      {contacts.map((contact) => (
        <Card key={contact.id} style={styles.contact}>
          <View style={styles.text}>
            <ThemedText type="headingS">{contact.name}</ThemedText>
            <ThemedText type="label" themeColor="textSecondary">{contact.mobileNumber}</ThemedText>
          </View>
          <Button
            label={t('contacts.remove')}
            accessibilityLabel={`${t('contacts.remove')} ${contact.name}`}
            variant="text"
            size="small"
            disabled={saving}
            onPress={() => void save(contacts.filter(({ id }) => id !== contact.id))}
          />
        </Card>
      ))}

      <Card style={styles.form}>
        <ThemedText type="headingS" accessibilityRole="header">{t('contacts.add')}</ThemedText>
        <Input label={t('contacts.name')} value={name} onChangeText={setName} autoComplete="name" />
        <Input
          label={t('auth.mobileNumber')}
          hint={t('auth.mobileHint')}
          value={mobileNumber}
          onChangeText={setMobileNumber}
          keyboardType="phone-pad"
          error={invalid ? t('contacts.invalid') : undefined}
        />
        <Button label={t('contacts.save')} size="large" loading={saving} onPress={() => void add()} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: Space[4], padding: Space[4], backgroundColor: Colors.background },
  contact: { flexDirection: 'row', alignItems: 'center', gap: Space[3], padding: Space[4] },
  text: { flex: 1, gap: 2 },
  form: { gap: Space[4], padding: Space[5] },
});
