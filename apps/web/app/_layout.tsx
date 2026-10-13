import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { colors } from '../design/tokens';

// Keep splash screen visible until ready
SplashScreen.preventAutoHideAsync();

// Load current Google Fonts used by the editor and generated screen previews.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (!document.getElementById('tezmind-google-fonts')) {
    const fontLink = document.createElement('link');
    fontLink.id = 'tezmind-google-fonts';
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(fontLink);
  }

  if (!document.getElementById('tezmind-ai-composer-motion')) {
    const style = document.createElement('style');
    style.id = 'tezmind-ai-composer-motion';
    style.textContent = `
      @keyframes tezmind-prompt-gradient-flow {
        0%, 100% { background-position: 0% 50%, 100% 50%; }
        50% { background-position: 0% 50%, 0% 50%; }
      }
      #tezmind-prompt-box {
        border: 1px solid transparent !important;
        background-image: linear-gradient(#fff, #fff), linear-gradient(115deg, #10A37F, #6B73E8, #C084FC, #10A37F) !important;
        background-origin: border-box !important;
        background-clip: padding-box, border-box !important;
        background-size: 100% 100%, 260% 260% !important;
        animation: tezmind-prompt-gradient-flow 8s ease-in-out infinite !important;
        box-shadow: 0 14px 40px rgba(35, 39, 62, .14), 0 0 24px rgba(16, 163, 127, .10) !important;
      }
      #tezmind-prompt-box:focus-within {
        box-shadow: 0 16px 44px rgba(35, 39, 62, .17), 0 0 0 3px rgba(16, 163, 127, .10) !important;
      }
      body, body *:not(.monaco-editor):not(.monaco-editor *) { font-family: Inter, 'DM Sans', system-ui, sans-serif !important; }
      @media (prefers-reduced-motion: reduce) {
        #tezmind-prompt-box { animation: none !important; }
      }
    `;
    document.head.appendChild(style);
  }
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" backgroundColor={colors.bg} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="project/new" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="project/[id]/editor" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
