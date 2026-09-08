import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The applicationId must never change — Android treats a different id as a
 * different app, which is exactly the "uninstall before installing" behaviour
 * we are avoiding. Signing key and id together are what let a release APK from
 * the GitHub releases page install straight over the previous build.
 */
const config: CapacitorConfig = {
  appId: 'games.dustline.forge',
  appName: 'Forge',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0d0e11',
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorHttp: { enabled: true },
  },
};

export default config;
