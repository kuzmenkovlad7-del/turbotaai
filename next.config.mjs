/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async redirects() {
    return [
      // Redirect bare domain → www (permanent 308 preserves method/body)
      {
        source: "/:path*",
        has: [{ type: "host", value: "turbotaai.com" }],
        destination: "https://www.turbotaai.com/:path*",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
