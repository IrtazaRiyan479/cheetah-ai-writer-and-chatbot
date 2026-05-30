/** @type {import('next').NextConfig} */
const nextConfig = {
    basePath: process.env.BASEPATH,
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
    },
    serverExternalPackages: ['amazon-paapi']
};
export default nextConfig;
