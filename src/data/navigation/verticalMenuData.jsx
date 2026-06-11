const verticalMenuData = (session) => {
  // Core navigation available to everyone
  const coreMenu = [
    { label: 'Home', href: '/home', icon: 'ri-home-smile-fill' },
    { label: 'CheetahChat', href: '/chat', icon: 'ri-chat-ai-2-fill' },
    { label: 'CheetahWriter', href: '/writer', icon: 'ri-edit-box-fill' },
    { label: 'CheetahImages', href: '/images', icon: 'ri-image-ai-fill' },
    { label: 'CheetahLinks', href: '/links', icon: 'ri-links-line' },
    { label: 'CheetahMagnets', href: '/magnets', icon: 'ri-book-marked-fill' },
    { label: 'Pricing', href: '/pricing', icon: 'ri-rocket-2-fill' },
    { label: 'Contact', href: '/contact', icon: 'ri-megaphone-fill' }
  ]

  // If the user is logged in, show Account and Logout
  if (session) {
    return [
      ...coreMenu,
      { label: 'Account', href: '/account', icon: 'ri-user-settings-fill' },
      { label: 'Logout', href: '/logout', icon: 'ri-logout-box-r-line' }
    ]
  }

  // If the user is logged out, show Login and Register
  return [
    ...coreMenu,
    { label: 'Login', href: '/login', icon: 'ri-git-repository-private-fill' },
    { label: 'Register', href: '/register', icon: 'ri-user-add-fill' }
  ]
}

export default verticalMenuData
