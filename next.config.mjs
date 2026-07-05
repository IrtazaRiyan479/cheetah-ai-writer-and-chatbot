/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    basePath: process.env.BASEPATH,
    serverExternalPackages: ['amazon-paapi'],
    redirects: async () => {
        return [
            {
                source: '/',
                destination: '/en/home',
                permanent: true,
                locale: false
            },
            {
                source: '/:lang(en|fr|ar)',
                destination: '/:lang/home',
                permanent: true,
                locale: false
            },
            {
                source: '/:path((?!en|fr|ar|front-pages|images|api|favicon.ico).*)*',
                destination: '/en/:path*',
                permanent: true,
                locale: false
            }
        ];
    }
};
export default nextConfig;
