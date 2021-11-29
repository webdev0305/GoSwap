import { FooterLinkType } from '@pancakeswap/uikit'
import { ContextApi } from 'contexts/Localization/types'

export const footerLinks: (t: ContextApi['t']) => FooterLinkType[] = (t) => [
  {
    label: t('Trading'),
    items: [
      {
        label: t('Forum'),
        href: 'https://docs.pancakeswap.finance/contact-us',
      },
      {
        label: t('Voting'),
        href: 'https://docs.pancakeswap.finance/brand',
      },
      {
        label: t('Announcements'),
        href: 'https://medium.com/pancakeswap',
      },
    ],
  },
  {
    label: t('About US'),
    items: [
      {
        label: t('Documents'),
        href: 'https://docs.pancakeswap.finance/contact-us',
      },
      {
        label: t('Go Token'),
        href: 'https://docs.pancakeswap.finance/brand',
      },
      {
        label: t('Whitepaper'),
        href: 'https://medium.com/pancakeswap',
      },
      {
        label: t('Roadmap'),
        href: 'https://docs.pancakeswap.finance/contact-us/telegram',
      },
    ],
  },
  {
    label: t('Support'),
    items: [
      {
        label: t('Help Center'),
        href: 'https://docs.pancakeswap.finance/contact-us/customer-support',
      },
      {
        label: t('Contact Us'),
        href: 'https://docs.pancakeswap.finance/help/troubleshooting',
      },
    ],
  },
  {
    label: t('Pages'),
    items: [
      {
        label: 'Exchange',
        href: 'https://github.com/pancakeswap',
      },
      {
        label: t('Farming'),
        href: 'https://docs.pancakeswap.finance',
      },
      {
        label: t('Staking'),
        href: 'https://app.gitbook.com/@pancakeswap-1/s/pancakeswap/code/bug-bounty',
      },
      {
        label: t('Liquidity'),
        href: 'https://docs.pancakeswap.finance/help/faq#is-pancakeswap-safe-has-pancakeswap-been-audited',
      },
    ],
  },
  {
    label: t('Blog'),
    items: [
      {
        label: t('News'),
        href: 'https://docs.pancakeswap.finance',
      },
      {
        label: t('FAQ'),
        href: 'https://app.gitbook.com/@pancakeswap-1/s/pancakeswap/code/bug-bounty',
      },
    ],
  },
]
