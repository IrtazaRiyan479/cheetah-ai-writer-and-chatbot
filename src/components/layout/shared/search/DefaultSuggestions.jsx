// Next Imports
import Link from 'next/link'
import { useParams } from 'next/navigation'

// Third-party Imports
import classnames from 'classnames'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

const defaultSuggestions = [
  {
    sectionLabel: 'Popular Searches',
    items: [
      { label: 'Home', href: '/home', icon: 'ri-home-smile-line' },
      { label: 'Privacy & Terms', href: '/privacy-terms', icon: 'ri-shield-check-line' },
      { label: 'Pricing', href: '/pricing', icon: 'ri-rocket-2-line' },
      { label: 'Contact', href: '/contact', icon: 'ri-megaphone-line' },
      { label: 'Drafts', href: '/drafts', icon: 'ri-draft-line' }
    ]
  },
  {
    sectionLabel: 'Apps',
    items: [
      { label: 'Chat', href: '/chat', icon: 'ri-chat-ai-2-line' },
      { label: 'Writer', href: '/writer', icon: 'ri-edit-box-line' },
      { label: 'Images', href: '/images', icon: 'ri-image-ai-line' },
      { label: 'Magnets', href: '/magnets', icon: 'ri-book-marked-line' },
      { label: 'Links', href: '/links', icon: 'ri-links-line' }
    ]
  },
  {
    sectionLabel: 'Pages',
    items: [
      { label: 'Login', href: '/login', icon: 'ri-git-repository-private-line' },
      { label: 'Register', href: '/register', icon: 'ri-user-add-line' },
      { label: 'Account', href: '/account', icon: 'ri-user-settings-line' }
    ]
  }
]

const DefaultSuggestions = ({ setOpen }) => {
  // Hooks
  const { lang: locale } = useParams()

  return (
    <div className='flex grow flex-wrap gap-x-[48px] gap-y-8 plb-14 pli-16 overflow-y-auto overflow-x-hidden bs-full'>
      {defaultSuggestions.map((section, index) => (
        <div
          key={index}
          className='flex flex-col justify-center overflow-x-hidden gap-4 basis-full sm:basis-[calc((100%-3rem)/2)]'
        >
          <p className='text-xs uppercase text-textDisabled tracking-[0.8px]'>{section.sectionLabel}</p>
          <ul className='flex flex-col gap-4'>
            {section.items.map((item, i) => (
              <li key={i} className='flex'>
                <Link
                  href={getLocalizedUrl(item.href, locale)}
                  className='flex items-center overflow-x-hidden cursor-pointer gap-2 hover:text-primary focus-visible:text-primary focus-visible:outline-0'
                  onClick={() => setOpen(false)}
                >
                  {item.icon && <i className={classnames(item.icon, 'flex text-xl shrink-0')} />}
                  <p className='text-[15px] truncate'>{item.label}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default DefaultSuggestions
