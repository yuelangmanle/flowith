import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.flowith.app",
  appName: "Flowith",
  webDir: "dist",
  server: {
    // In development, point to the Vite dev server
    // url: "http://192.168.x.x:5173",
    // cleartext: true,
    androidScheme: "https",
  },
  android: {
    buildOptions: {
      // Signing config can be added here for release builds
    },
  },
};

export default config;
