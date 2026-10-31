import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import notices from '../../../../assets/licenses/notices.json';
import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Input } from '@/common/components/ui/input';
import { useTheme } from '@/common/hooks/use-theme';
import { Space } from '@/common/lib/theme';

export function LicensesScreen() {
  const { t } = useTranslation(); const theme = useTheme();
  const [search, setSearch] = useState(''); const [selected, setSelected] = useState<string | null>(null);
  return <View style={[styles.root, { backgroundColor: theme.background }]}>
    <ThemedText type="label" themeColor="textSecondary">{t('preferences.licenseNotice')}</ThemedText>
    <Input label={t('preferences.licenses')} value={search} onChangeText={setSearch} />
    <FlatList data={notices.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))}
      keyExtractor={(item) => `${item.name}@${item.version}`} keyboardShouldPersistTaps="handled" renderItem={({ item }) => {
        const key = `${item.name}@${item.version}`;
        return <View style={[styles.item, { borderColor: theme.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('preferences.readLicense')} ${key}`}
            accessibilityState={{ expanded: selected === key }} onPress={() => setSelected(selected === key ? null : key)} style={styles.heading}>
            <ThemedText type="bodyMedium">{item.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{item.version} · {item.license}</ThemedText>
          </Pressable>
          {selected === key ? <>
            <ThemedText type="small" selectable>{item.text}</ThemedText>
            <Button label={t('preferences.closeLicense')} variant="text" onPress={() => setSelected(null)} />
          </> : null}
        </View>;
      }} />
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, padding: Space[4], gap: Space[4] }, item: { paddingVertical: Space[3], gap: Space[2], borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { minHeight: 48, justifyContent: 'center', gap: Space[1] } });
