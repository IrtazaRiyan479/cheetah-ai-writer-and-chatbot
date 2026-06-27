const verticalMenuData = (session) => {
  // Core navigation available to everyone
  const coreMenu = [
    { label: 'Home', href: '/home', icon: 'ri-home-smile-fill' },
    { label: 'AffiGenieChat', href: '/chat', icon: 'ri-chat-ai-2-fill' },
    { label: 'AffiGenieWriter', href: '/writer', icon: 'ri-edit-box-fill' },
    { label: 'AffiGenieImages', href: '/images', icon: 'ri-image-ai-fill' },
    { label: 'AffiGenieLinks', href: '/links', icon: 'ri-links-line' },
    { label: 'AffiGenieMagnets', href: '/magnets', icon: 'ri-book-marked-fill' },
    { label: 'Pricing', href: '/pricing', icon: 'ri-rocket-2-fill' },
    { label: 'Contact', href: '/contact', icon: 'ri-megaphone-fill' },
  ]

  if (session) {
    return [
      ...coreMenu,
      { label: 'Account', href: '/account', icon: 'ri-user-settings-fill' },
      { label: 'Logout', href: '/logout', icon: 'ri-logout-box-r-line' },
      { label: 'Drafts', href: '/drafts', icon: 'ri-draft-fill' }
    ]
  }
  return [
    ...coreMenu,
    { label: 'Login', href: '/login', icon: 'ri-git-repository-private-fill' },
    { label: 'Register', href: '/register', icon: 'ri-user-add-fill' }
  ]
}

export default verticalMenuData
