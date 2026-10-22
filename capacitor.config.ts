import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.nickdi92.vento',
  appName: 'Vento',
  webDir: 'dist',
  backgroundColor: '#08202a',
  ios: {
    // The page already pads itself with env(safe-area-inset-*).
    contentInset: 'never',
    scrollEnabled: true,
  },
};

export default config;
