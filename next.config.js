/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.imagedelivery.net",
      },
      {
        protocol: "https",
        hostname: "**.warpcast.com",
      },
    ],
  },
};

module.exports = nextConfig;
