import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import notices from '../../../../assets/licenses/notices.json';
import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Input } from '@/common/components/ui/input';
import { ScreenHero } from '@/common/components/ui/screen-hero';
import { useTheme } from '@/common/hooks/use-theme';
import { MaxContentWidth, Space } from '@/common/lib/theme';

export function LicensesScreen() {
  const { t } = useTranslation(); const theme = useTheme(); const { bottom } = useSafeAreaInsets();
  const [search, setSearch] = useState(''); const [selected, setSelected] = useState<string | null>(null);
  return <FlatList data={notices.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))}
    style={{ backgroundColor: theme.background }} contentContainerStyle={{ paddingBottom: bottom + Space[8] }} contentInsetAdjustmentBehavior="never"
    keyExtractor={(item) => `${item.name}@${item.version}`} keyboardShouldPersistTaps="handled"
    ListHeaderComponent={<>
      <ScreenHero back title={t('preferences.licenses')} />
      <View style={styles.header}><View style={styles.content}>
        <ThemedText type="label" themeColor="textSecondary">{t('preferences.licenseNotice')}</ThemedText>
        <Input label={t('preferences.licenses')} value={search} onChangeText={setSearch} />
      </View></View>
    </>}
    renderItem={({ item }) => {
      const key = `${item.name}@${item.version}`;
      return <View style={styles.row}><View style={[styles.content, styles.item, { borderColor: theme.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('preferences.readLicense')} ${key}`}
          accessibilityState={{ expanded: selected === key }} onPress={() => setSelected(selected === key ? null : key)} style={styles.heading}>
          <ThemedText type="bodyMedium">{item.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{item.version} · {item.license}</ThemedText>
        </Pressable>
        {selected === key ? <>
          <ThemedText type="small" selectable>{item.text}</ThemedText>
          <Button label={t('preferences.closeLicense')} variant="text" onPress={() => setSelected(null)} />
        </> : null}
      </View></View>;
    }} />;
}
const styles = StyleSheet.create({ header: { padding: Space[4], alignItems: 'center' }, row: { paddingHorizontal: Space[4], alignItems: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, gap: Space[4] },
  item: { paddingVertical: Space[3], gap: Space[2], borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { minHeight: 48, justifyContent: 'center', gap: Space[1] } });
