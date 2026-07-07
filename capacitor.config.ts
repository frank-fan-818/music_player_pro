import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.musicplayerpro.app',
  appName: 'MusicPlayer Pro',
  webDir: 'dist',
  server: {
    // http fine for local WebView assets
    androidScheme: 'http',
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
    },
    allowMixedContent: true,
  },
}

export default config
