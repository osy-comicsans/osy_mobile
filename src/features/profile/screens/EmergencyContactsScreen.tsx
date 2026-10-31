import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Input } from '@/common/components/ui/input';
import { Space } from '@/common/lib/theme';
import { leftToRight } from '@/common/lib/i18n/format';
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
  const { cache, rejection } = useProfile(); const service = useProfileService();
  const contacts = cache?.bundle.contacts ?? [];
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
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
      const latest = (await service.read())?.bundle;
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

  const reset = () => {
    setName('');
    setMobileNumber('+213');
    setRelationship(''); setEditing(null); setInvalid(false);
  };

  const add = async () => {
    const parsed = emergencyContactSchema.safeParse({ id: editing ?? createId(), name, mobileNumber, relationship: relationship.trim() || null });
    setInvalid(!parsed.success);
    if (!parsed.success) return;
    const next = editing ? contacts.map((contact) => contact.id === editing ? parsed.data : contact) : [...contacts, parsed.data];
    if (await save(next)) reset();
  };

  const remove = async (id: string) => {
    if (await save(contacts.filter((contact) => contact.id !== id))) {
      setRemoving(null);
      if (editing === id) reset();
    }
  };

  return (
    <AccountPage title={t('profile.emergencyContacts')} description={t('contacts.description')}>
      {!cache ? <ThemedText themeColor="textSecondary">{t('account.signInHint')}</ThemedText> : null}
      {cache?.dirty ? <ThemedText themeColor={rejection ? 'errorText' : 'textSecondary'}>{t(rejection ? 'account.attentionTitle' : 'account.pending')}</ThemedText> : null}
      {failed && <ThemedText type="label" themeColor="errorText" accessibilityRole="alert">{t('contacts.failed')}</ThemedText>}

      {contacts.map((contact) => (
        <Card glass key={contact.id} style={styles.contact}>
          <View style={styles.text}>
            <ThemedText type="headingS">{contact.name}</ThemedText>
            <ThemedText type="label" themeColor="textSecondary">{leftToRight(contact.mobileNumber)}</ThemedText>
            {contact.relationship ? <ThemedText type="small" themeColor="textSecondary">{contact.relationship}</ThemedText> : null}
          </View>
          {removing === contact.id ? <View style={styles.confirm}>
            <ThemedText type="label" accessibilityRole="alert">{t('contacts.removeConfirm', { name: contact.name })}</ThemedText>
            <View style={styles.actions}>
              <Button label={t('contacts.remove')} variant="destructive" size="small" loading={saving} onPress={() => void remove(contact.id)} />
              <Button label={t('preferences.cancel')} variant="text" size="small" disabled={saving} onPress={() => setRemoving(null)} />
            </View>
          </View> : <>
            <Button label={t('account.editContact')} variant="text" size="small" disabled={saving}
              onPress={() => { setEditing(contact.id); setName(contact.name); setMobileNumber(contact.mobileNumber); setRelationship(contact.relationship ?? ''); setInvalid(false); }} />
            <Button
              label={t('contacts.remove')}
              accessibilityLabel={`${t('contacts.remove')} ${contact.name}`}
              variant="text"
              size="small"
              disabled={saving}
              onPress={() => setRemoving(contact.id)}
            />
          </>}
        </Card>
      ))}

      <Card glass style={styles.form}>
        <ThemedText type="headingS" accessibilityRole="header">{t(editing ? 'contacts.edit' : 'contacts.add')}</ThemedText>
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
        {editing ? <Button label={t('preferences.cancel')} variant="text" disabled={saving} onPress={reset} /> : null}
      </Card>
    </AccountPage>
  );
}

const styles = StyleSheet.create({
  contact: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[3], padding: Space[4] },
  text: { flex: 1, gap: 2 },
  confirm: { flexBasis: '100%', gap: Space[2] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[2] },
  form: { gap: Space[4], padding: Space[5] },
});
