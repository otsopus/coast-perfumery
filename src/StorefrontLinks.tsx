import { Facebook, Instagram } from 'lucide-react'

function ShopeeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 8h15l1 11a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2l1-11Z" />
      <path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2m-1.3 4.3c-.6-.5-1.3-.8-2.2-.8-1.1 0-2 .6-2 1.4 0 2 4.2 1.1 4.2 3.3 0 .9-1 1.5-2.2 1.5-.9 0-1.8-.3-2.5-.9" />
    </svg>
  )
}

function LazadaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 7 4.5-2.7a1.5 1.5 0 0 1 1.5 0l3 1.8a1.5 1.5 0 0 1 .7 1.3v6.9a1.5 1.5 0 0 1-.7 1.3l-8.2 4.9a1.5 1.5 0 0 1-1.6 0L3 15.6a1.5 1.5 0 0 1-.7-1.3V7.4A1.5 1.5 0 0 1 3 6.1l3-1.8a1.5 1.5 0 0 1 1.5 0L12 7Z" />
      <path d="m2.8 6.6 9.2 5.5 9.2-5.5M12 12.1v8.6" />
    </svg>
  )
}

const platforms = {
  marketplace: {
    label: 'Shop on marketplaces',
    links: [
      { name: 'Shopee', href: 'https://ph.shp.ee/LAgqyEwk', Icon: ShopeeIcon },
      { name: 'Lazada', href: 'https://s.lazada.com.ph/s.0a2asl', Icon: LazadaIcon },
    ],
  },
  social: {
    label: 'Coast Perfumery social media',
    links: [
      { name: 'Facebook', href: 'https://www.facebook.com/coastperfumerymnl', Icon: Facebook },
      { name: 'Instagram', href: 'https://www.instagram.com/coastperfumerymnl', Icon: Instagram },
    ],
  },
}

export function StorefrontLinks({ group }: { group: keyof typeof platforms }) {
  const { label, links } = platforms[group]

  return (
    <nav className={`platform-links ${group}-links`} aria-label={label}>
      {links.map(({ name, href, Icon }) => (
        <a className="platform-link" key={name} href={href} target="_blank" rel="noopener noreferrer" title={group === 'social' ? name : undefined}>
          <Icon size={18} aria-hidden="true" />
          <span className={group === 'social' ? 'sr-only' : undefined}>{name}</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ))}
    </nav>
  )
}
