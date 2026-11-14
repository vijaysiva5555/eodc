/** @type {import('next').NextConfig} */
const nextConfig = { experimental: { serverComponentsExternalPackages: ['mongoose', 'exceljs', '@aws-sdk/client-s3'] } };
export default nextConfig;
