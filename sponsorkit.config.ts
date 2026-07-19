import { defineConfig, tierPresets as presets } from 'sponsorkit'
import fs from 'node:fs/promises'

export default defineConfig({
  github: {
    login: 'authlib',
    type: 'organization',
  },
  tiers: [
    {
      title: 'Past Sponsors',
      monthlyDollars: -1,
      preset: presets.xs,
    },
    {
      title: 'Supporters',
      preset: presets.small,
    },
    {
      title: 'Backers',
      monthlyDollars: 10,
      preset: presets.base,
    },
    {
      title: 'Sponsors',
      monthlyDollars: 25,
      preset: presets.medium,
    },
    {
      title: 'Silver Sponsors',
      monthlyDollars: 50,
      preset: presets.large,
    },
    {
      title: 'Gold Sponsors',
      monthlyDollars: 100,
      preset: presets.xl,
    },
  ],

  async onSponsorsReady(sponsors) {
    await fs.writeFile(
      'sponsors.json',
      JSON.stringify(
        sponsors
          .filter((i) => i.privacyLevel !== 'PRIVATE')
          .map((i) => {
            return {
              name: i.sponsor.name,
              login: i.sponsor.login,
              avatar: i.sponsor.avatarUrl,
              amount: i.monthlyDollars,
              link: i.sponsor.linkUrl || i.sponsor.websiteUrl,
              org: i.sponsor.type === 'Organization'
            }
          })
          .sort((a, b) => b.amount - a.amount),
        null,
        2
      )
    )
  },

  outputDir: '.',
  formats: ['svg'],
  width: 800,
  renderer: 'tiers',
})
