import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Icon } from '@/common/components/ui/icon';
import { Colors, Palette, Radius, Space } from '@/common/lib/theme';
import type { DocumentFieldKey } from '@/features/auth/types/auth.schemas';

import type { useVehicle } from '../hooks/useVehicle';

const KEY_SPECS: DocumentFieldKey[] = ['firstRegistrationYear', 'energy', 'power', 'seats'];
const MORE_SPECS: DocumentFieldKey[] = ['genre', 'bodyType', 'grossWeight', 'payload', 'serialNumber', 'previousNumber'];

export function VehicleCard({ vehicle }: { vehicle: ReturnType<typeof useVehicle> }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { details, model, photo } = vehicle;
  const keySpecs = KEY_SPECS.filter((key) => details?.[key]);
  const moreSpecs = MORE_SPECS.filter((key) => details?.[key]);

  return (
    <Card tone="ink" padded={false} style={styles.card}>
      {photo ? <Image source={{ uri: photo }} cachePolicy="memory-disk" contentFit="cover" transition={200}
        accessibilityLabel={t('account.vehiclePhotoLabel', { model })} style={styles.photo} /> : null}
      <View style={styles.body}>
        <View style={styles.title}>
          {photo ? null : <View style={styles.icon}><Icon name="car" size={22} color={Colors.onAccent} /></View>}
          <View style={styles.name}>
            <ThemedText type="overline" style={styles.muted}>{t('account.myVehicle')}</ThemedText>
            {model ? <ThemedText type="heading" style={styles.light}>{model}</ThemedText> : null}
          </View>
          {details?.registrationNumber ? <View style={styles.plate}>
            <ThemedText type="label" style={styles.plateText} accessibilityLabel={`${t('documents.fields.registrationNumber')} ${details.registrationNumber}`}>{details.registrationNumber}</ThemedText>
          </View> : null}
        </View>
        {!model ? <ThemedText type="label" style={styles.muted}>{t('account.vehicleEmpty')}</ThemedText> : null}
        {keySpecs.length ? <View style={styles.grid}>
          {keySpecs.map((key) => <View key={key} accessible style={styles.tile}>
            <ThemedText type="bodyMedium" style={styles.light}>{details?.[key]}</ThemedText>
            <ThemedText type="small" style={styles.muted}>{t(`documents.fields.${key}`)}</ThemedText>
          </View>)}
        </View> : null}
        {expanded ? moreSpecs.map((key) => <View key={key} accessible style={styles.spec}>
          <ThemedText type="label" style={styles.muted}>{t(`documents.fields.${key}`)}</ThemedText>
          <ThemedText type="label" style={[styles.light, styles.value]}>{details?.[key]}</ThemedText>
        </View>) : null}
        {moreSpecs.length ? <Button variant="text" tone="dark" size="small" accessibilityState={{ expanded }}
          label={t(expanded ? 'account.vehicleLess' : 'account.vehicleMore')} onPress={() => setExpanded(!expanded)} /> : null}
        {photo ? <ThemedText type="small" style={styles.muted}>{t('account.vehiclePhotoCredit')}</ThemedText> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  photo: { aspectRatio: 16 / 9, backgroundColor: Palette.neutral[700] },
  body: { padding: Space[5], gap: Space[4] },
  title: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[3] },
  icon: { width: 44, height: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.purple[500] },
  name: { flex: 1, minWidth: 120, gap: 2 },
  light: { color: Palette.white },
  muted: { color: Palette.purple[200] },
  plate: { paddingHorizontal: Space[3], paddingVertical: Space[1], borderRadius: Radius.sm, backgroundColor: Palette.white },
  plateText: { color: Palette.neutral[800] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] },
  tile: { flexBasis: '47%', flexGrow: 1, gap: 2, padding: Space[3], borderRadius: Radius.md, backgroundColor: Palette.neutral[700] },
  spec: { flexDirection: 'row', justifyContent: 'space-between', gap: Space[4] },
  value: { flexShrink: 1, textAlign: 'right' },
});
