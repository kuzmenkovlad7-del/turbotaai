export type SiteNavItem = {
  href: string
  labelKey: string
}

export const SITE_NAV: SiteNavItem[] = [
  { href: "/", labelKey: "Home" },
  { href: "/about", labelKey: "About" },
  { href: "/contacts", labelKey: "Contacts" },
  { href: "/pricing", labelKey: "Pricing" },
]
