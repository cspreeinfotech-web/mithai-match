import type { CapacitorConfig } from '@capacitor/cli';
import appConfig from './src/config/app.config.json';

const config: CapacitorConfig = {
  appId: appConfig.appId,
  appName: appConfig.appName,
  webDir: 'dist',
  android: {
    buildOptions: {
      releaseType: 'AAB',
    },
  },
};

export default config;
