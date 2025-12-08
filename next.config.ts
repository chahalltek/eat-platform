import type { NextConfig } from "next";

import { describeKillSwitch, getKillSwitchState, KILL_SWITCHES } from "./src/lib/killSwitch";

const nextConfig: NextConfig = {
  experimental: {
    // Allow Turbopack to use system TLS certs so font downloads succeed in CI
    turbopackUseSystemTlsCerts: true,
  },
};

const builderKillSwitch = getKillSwitchState(KILL_SWITCHES.BUILDERS);

if (builderKillSwitch.latched) {
  const label = describeKillSwitch(KILL_SWITCHES.BUILDERS);
  throw new Error(`${label} are disabled via kill switch: ${builderKillSwitch.reason}`);
}

export default nextConfig;
