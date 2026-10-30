import { Image } from 'expo-image';

import { SplashBrand, type LoadingTone } from '@/common/lib/startup/brand';

export function BrandMark({ tone = 'light', size = SplashBrand.imageSize, onReady }: {
  tone?: LoadingTone; size?: number; onReady?: () => void;
}) {
  return (
    <Image
      source={tone === 'dark' ? require('@/assets/brand/osy-splash-dark.png') : require('@/assets/brand/osy-splash-light.png')}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={0}
      accessible={false}
      onLoadEnd={onReady}
      onError={onReady}
    />
  );
}
