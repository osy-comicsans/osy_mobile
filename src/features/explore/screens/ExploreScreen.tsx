import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExternalLink } from '@/common/components/external-link';
import { ThemedText } from '@/common/components/themed-text';
import { ThemedView } from '@/common/components/themed-view';
import { AmbientBackground } from '@/common/components/ui/ambient-background';
import { Collapsible } from '@/common/components/ui/collapsible';
import { WebBadge } from '@/common/components/web-badge';
import { BottomTabInset, Colors, MaxContentWidth, Radius, Spacing } from '@/common/lib/theme';

export function ExploreScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      paddingTop: Spacing.six,
      paddingBottom: Spacing.four,
    },
  });

  return (
    <View style={styles.screen}>
      <AmbientBackground />
      <ScrollView
        style={styles.scrollView}
        contentInset={insets}
        contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
        <View style={styles.container}>
          <View style={styles.titleContainer}>
            <ThemedText type="subtitle">Explore</ThemedText>
            <ThemedText style={styles.centerText} themeColor="textSecondary">
              This starter app includes example{'\n'}code to help you get started.
            </ThemedText>

            <ExternalLink href="https://docs.expo.dev" asChild>
              <Pressable style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="accentSoft" style={styles.linkButton}>
                  <ThemedText type="link">Expo documentation</ThemedText>
                  <SymbolView
                    tintColor={Colors.accent}
                    name={{ ios: 'arrow.up.right.square', android: 'link', web: 'link' }}
                    size={12}
                  />
                </ThemedView>
              </Pressable>
            </ExternalLink>
          </View>

          <View style={styles.sectionsWrapper}>
            <Collapsible title="File-based routing">
              <ThemedText type="label">
                This app has two routes: <ThemedText type="code">src/app/index.tsx</ThemedText> and{' '}
                <ThemedText type="code">src/app/explore.tsx</ThemedText>
              </ThemedText>
              <ThemedText type="label">
                Screen implementations live in <ThemedText type="code">src/features/</ThemedText>.
                Routes only select which screen to render.
              </ThemedText>
              <ThemedText type="label">
                The layout file in <ThemedText type="code">src/app/_layout.tsx</ThemedText> sets up
                the tab navigator.
              </ThemedText>
              <ExternalLink href="https://docs.expo.dev/router/introduction">
                <ThemedText type="linkPrimary">Learn more</ThemedText>
              </ExternalLink>
            </Collapsible>

            <Collapsible title="Android, iOS, and web support">
              <ThemedText type="label">
                You can open this project on Android, iOS, and the web. To open the web version,
                press <ThemedText type="smallBold">w</ThemedText> in the terminal running this
                project.
              </ThemedText>
              <Image
                source={require('@/assets/images/tutorial-web.png')}
                style={styles.imageTutorial}
              />
            </Collapsible>

            <Collapsible title="Images">
              <ThemedText type="label">
                For static images, you can use the <ThemedText type="code">@2x</ThemedText> and{' '}
                <ThemedText type="code">@3x</ThemedText> suffixes to provide files for different
                screen densities.
              </ThemedText>
              <Image source={require('@/assets/images/react-logo.png')} style={styles.imageReact} />
              <ExternalLink href="https://reactnative.dev/docs/images">
                <ThemedText type="linkPrimary">Learn more</ThemedText>
              </ExternalLink>
            </Collapsible>

            <Collapsible title="OSY design system">
              <ThemedText type="label">
                Colors, spacing, radii, shadows, and type come from the shared tokens in{' '}
                <ThemedText type="code">src/common/lib/tokens.ts</ThemedText>. Components use the
                purple accent, pill buttons, 16px cards, and Gabarito typography.
              </ThemedText>
            </Collapsible>

            <Collapsible title="Animations">
              <ThemedText type="label">
                This template includes an example of an animated component. The{' '}
                <ThemedText type="code">src/common/components/ui/collapsible.tsx</ThemedText>{' '}
                component uses the powerful{' '}
                <ThemedText type="code">react-native-reanimated</ThemedText> library to animate
                opening this hint.
              </ThemedText>
            </Collapsible>
          </View>
          {Platform.OS === 'web' && <WebBadge />}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
  },
  titleContainer: {
    gap: Spacing.three,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  linkButton: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    justifyContent: 'center',
    gap: Spacing.one,
    alignItems: 'center',
  },
  sectionsWrapper: {
    gap: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  imageTutorial: {
    width: '100%',
    aspectRatio: 296 / 171,
    borderRadius: Radius.lg,
    marginTop: Spacing.two,
  },
  imageReact: {
    width: 100,
    height: 100,
    alignSelf: 'center',
  },
});
