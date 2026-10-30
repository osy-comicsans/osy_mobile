import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { getLanguage } from '@/common/lib/i18n/i18n';
import { isRtl } from '@/common/lib/i18n/languages';
import { Colors, Palette, Shadow } from '@/common/lib/theme';

export type SliderProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  tone?: 'light' | 'dark';
  accessibilityLabel?: string;
  formatValue?: (value: number) => string;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function Slider({
  value,
  min,
  max,
  step = 0.1,
  onChange,
  tone = 'light',
  accessibilityLabel,
  formatValue,
}: SliderProps) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const progress = clamp((value - min) / (max - min), 0, 1);
  const dark = tone === 'dark';

  const round = (next: number) => Math.round(next / step) * step;
  const move = (event: GestureResponderEvent) => {
    if (width <= 0) return;
    const position = clamp(event.nativeEvent.locationX / width, 0, 1);
    const ratio = isRtl(getLanguage()) ? 1 - position : position;
    onChange(clamp(round(min + ratio * (max - min)), min, max));
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel ?? t('common.slider')}
      accessibilityValue={{
        min,
        max,
        now: value,
        text: formatValue?.(value) ?? String(value),
      }}
      accessibilityActions={[
        { name: 'increment', label: t('common.increase') },
        { name: 'decrement', label: t('common.decrease') },
      ]}
      onAccessibilityAction={({ nativeEvent }) =>
        onChange(clamp(round(value + (nativeEvent.actionName === 'increment' ? step : -step)), min, max))
      }
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={move}
      onResponderMove={move}
      onResponderTerminationRequest={() => false}
      style={styles.touchTrack}>
      <View
        pointerEvents="none"
        style={[styles.track, { backgroundColor: dark ? Palette.neutral[700] : Colors.backgroundElement }]}>
        <View
          style={[
            styles.fill,
            { width: `${progress * 100}%`, backgroundColor: dark ? Palette.purple[400] : Colors.accent },
          ]}
        />
        <View
          style={[
            styles.thumb,
            { start: `${progress * 100}%`, borderColor: dark ? Palette.purple[300] : Colors.accent },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  touchTrack: { height: 44, justifyContent: 'center', paddingHorizontal: 10 },
  track: { height: 6, borderRadius: 3 },
  fill: { height: 6, borderRadius: 3 },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    marginStart: -10,
    top: -7,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 3,
    boxShadow: Shadow.sm,
  },
});
