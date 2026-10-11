import type { NextConfig } from "next";
const config: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  distDir: process.env.PROOFPAK_E2E === "1" ? ".next-e2e" : ".next",
};
export default config;
