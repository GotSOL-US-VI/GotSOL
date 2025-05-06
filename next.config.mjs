/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@getpara/react-sdk", "@getpara/*"],
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'ipfs.filebase.io',
          pathname: '/ipfs/**',
        },
        {
          protocol: 'https',
          hostname: 'raw.githubusercontent.com',
          pathname: '/**',
        },
      ],
    },
  };
  
  export default nextConfig;