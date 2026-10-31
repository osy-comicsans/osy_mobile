import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Input } from '@/common/components/ui/input';
import { Space } from '@/common/lib/theme';
import { createId } from '@/common/lib/native/uuid';
import { AccountPage } from '@/common/components/ui/account-page';
import { useProfile, useProfileService } from '../providers/ProfileDataProvider';

import { emergencyContactSchema, type EmergencyContact } from '../types/profile.schemas';

export function EmergencyContactsScreen() {
  const { cache } = useProfile();
  return <ContactsEditor key={cache?.bundle.profile.id ?? 'guest'} />;
}

function ContactsEditor() {
  const { t } = useTranslation();
  const { cache } = useProfile(); const service = useProfileService();
  const contacts = cache?.bundle.contacts ?? [];
  const [editing, setEditing] = useState<string | null>(null);
  const [relationship, setRelationship] = useState('');
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('+213');
  const [failed, setFailed] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async (next: EmergencyContact[]) => {
    setSaving(true);
    setFailed(false);
    try {
      const latest = service.store.getState().cache?.bundle;
      if (!latest || latest.profile.id !== cache?.bundle.profile.id) throw new Error('Sign in before editing.');
      await service.save({ ...latest, contacts: next });
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    const parsed = emergencyContactSchema.safeParse({ id: editing ?? createId(), name, mobileNumber, relationship: relationship.trim() || null });
    setInvalid(!parsed.success);
    if (!parsed.success) return;
    const next = editing ? contacts.map((contact) => contact.id === editing ? parsed.data : contact) : [...contacts, parsed.data];
    if (await save(next)) {
      setName('');
      setMobileNumber('+213');
      setRelationship(''); setEditing(null);
    }
  };

  return (
    <AccountPage title={t('profile.emergencyContacts')} description={t('contacts.description')}>
      {!cache ? <ThemedText themeColor="textSecondary">{t('account.signInHint')}</ThemedText> : null}
      {cache?.dirty ? <ThemedText themeColor="textSecondary">{t('account.pending')}</ThemedText> : null}
      {failed && <ThemedText type="label" themeColor="errorText" accessibilityRole="alert">{t('contacts.failed')}</ThemedText>}

      {contacts.map((contact) => (
        <Card glass key={contact.id} style={styles.contact}>
          <View style={styles.text}>
            <ThemedText type="headingS">{contact.name}</ThemedText>
            <ThemedText type="label" themeColor="textSecondary">{contact.mobileNumber}</ThemedText>
            {contact.relationship ? <ThemedText type="small" themeColor="textSecondary">{contact.relationship}</ThemedText> : null}
          </View>
          <Button label={t('account.editContact')} variant="text" size="small" disabled={saving}
            onPress={() => { setEditing(contact.id); setName(contact.name); setMobileNumber(contact.mobileNumber); setRelationship(contact.relationship ?? ''); }} />
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

      <Card glass style={styles.form}>
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
        <Input label={t('account.relationship')} value={relationship} onChangeText={setRelationship} maxLength={50} />
        <Button label={t('contacts.save')} size="large" loading={saving} disabled={!cache} onPress={() => void add()} />
      </Card>
    </AccountPage>
  );
}

const styles = StyleSheet.create({
  contact: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[3], padding: Space[4] },
  text: { flex: 1, gap: 2 },
  form: { gap: Space[4], padding: Space[5] },
});
