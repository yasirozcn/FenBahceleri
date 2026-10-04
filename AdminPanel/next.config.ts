import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Canlı sunucu (Docker) için: yalnızca gereken dosyaları .next/standalone'a kopyalar → küçük imaj.
  output: "standalone",
};

export default nextConfig;
