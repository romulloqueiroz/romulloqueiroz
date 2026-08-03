import { mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'

const username = process.env.PROFILE_USERNAME || 'romulloqueiroz'

const query = `
  query ProfileBuilderSignal($login: String!) {
    viewer {
      login
    }
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
      pullRequests {
        totalCount
      }
      issues {
        totalCount
      }
    }
  }
`

const contributionRanks = [
  ['SSS', 4000],
  ['SS', 2000],
  ['S', 1000],
  ['AAA', 500],
  ['AA', 200],
  ['A', 100],
  ['B', 10],
  ['C', 1],
]

const collaborationRanks = [
  ['SSS', 1000],
  ['SS', 500],
  ['S', 200],
  ['AAA', 100],
  ['AA', 50],
  ['A', 20],
  ['B', 10],
  ['C', 1],
]

function rankFor(value, bands) {
  return bands.find(([, minimum]) => value >= minimum)?.[0] || 'NEW'
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value)
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function updatedLabel() {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date())
    .toUpperCase()
}

function normalize(payload) {
  const user = payload?.data?.user
  if (!user) {
    const message = payload?.errors?.map((error) => error.message).join('; ')
    throw new Error(message || `GitHub returned no data for ${username}`)
  }

  const calendar = user.contributionsCollection?.contributionCalendar
  const contributions = calendar?.totalContributions
  const pullRequests = user.pullRequests?.totalCount
  const issues = user.issues?.totalCount

  for (const [label, value] of Object.entries({ contributions, pullRequests, issues })) {
    if (!Number.isFinite(value)) {
      throw new Error(`GitHub returned an invalid ${label} count`)
    }
  }

  const weeks = (calendar.weeks || []).map((week) =>
    week.contributionDays.reduce((total, day) => total + day.contributionCount, 0),
  )

  return {
    contributions,
    contributionRank: rankFor(contributions, contributionRanks),
    pullRequests,
    pullRequestRank: rankFor(pullRequests, collaborationRanks),
    issues,
    issueRank: rankFor(issues, collaborationRanks),
    weeks,
    viewer: payload.data.viewer?.login || 'unknown',
  }
}

function weeklyBars(weeks, { x, baseline, width, maxHeight, color }) {
  if (!weeks.length) return ''

  const gap = 3
  const barWidth = Math.max(2, (width - gap * (weeks.length - 1)) / weeks.length)
  const maximum = Math.max(...weeks, 1)

  return weeks
    .map((value, index) => {
      const intensity = value === 0 ? 0.08 : 0.28 + 0.72 * Math.sqrt(value / maximum)
      const height = value === 0 ? 2 : Math.max(4, maxHeight * Math.sqrt(value / maximum))
      const barX = x + index * (barWidth + gap)
      const barY = baseline - height
      return `<rect x="${barX.toFixed(2)}" y="${barY.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${height.toFixed(2)}" rx="${Math.min(3, barWidth / 2).toFixed(2)}" fill="${color}" opacity="${intensity.toFixed(2)}"/>`
    })
    .join('')
}

const palettes = {
  light: {
    background: '#FAF8FC',
    border: '#DED7E5',
    grid: '#E2DCE8',
    text: '#211D25',
    muted: '#756A7E',
    primary: '#7054B4',
    primarySoft: '#EEE8F6',
    primaryText: '#684E9C',
    accent: '#A65370',
    panel: '#FFFFFF',
    panelBorder: '#D8D0DF',
  },
  dark: {
    background: '#151419',
    border: '#302D35',
    grid: '#2A2730',
    text: '#F6F1F8',
    muted: '#AAA0AF',
    primary: '#BFA9FF',
    primarySoft: '#393244',
    primaryText: '#CFBEFF',
    accent: '#D58AA5',
    panel: '#211F24',
    panelBorder: '#3A3640',
  },
}

function renderDesktop(stats, theme) {
  const p = palettes[theme]
  const bars = weeklyBars(stats.weeks, {
    x: 470,
    baseline: 310,
    width: 678,
    maxHeight: 43,
    color: p.primary,
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 340" role="img" aria-labelledby="title desc">
  <title id="title">Builder signal: ${escapeXml(stats.contributionRank)} contribution rank</title>
  <desc id="desc">${formatNumber(stats.contributions)} contributions in the last 12 months, ${formatNumber(stats.pullRequests)} pull requests and ${formatNumber(stats.issues)} issues across all time.</desc>
  <defs>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="${p.grid}" stroke-width="1"/>
    </pattern>
    <linearGradient id="rank" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="${p.primary}"/><stop offset="1" stop-color="${p.accent}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="340" rx="26" fill="${p.background}" stroke="${p.border}"/>
  <rect width="1200" height="340" rx="26" fill="url(#grid)" opacity=".58"/>

  <g font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <rect x="52" y="34" width="162" height="32" rx="16" fill="${p.primarySoft}" stroke="${p.panelBorder}"/>
    <circle cx="71" cy="50" r="5" fill="${p.primary}"/>
    <text x="84" y="55" fill="${p.primaryText}" font-size="12" font-weight="750" letter-spacing="1.35">BUILDER SIGNAL</text>
    <text x="1148" y="55" text-anchor="end" fill="${p.muted}" font-size="12" font-weight="700" letter-spacing="1.1">VERIFIED GITHUB ACTIVITY · UPDATED ${updatedLabel()}</text>

    <text x="52" y="178" fill="url(#rank)" font-size="112" font-weight="780" letter-spacing="-5">${escapeXml(stats.contributionRank)}</text>
    <text x="55" y="222" fill="${p.text}" font-size="25" font-weight="760">${formatNumber(stats.contributions)} CONTRIBUTIONS</text>
    <text x="55" y="248" fill="${p.muted}" font-size="13" font-weight="700" letter-spacing="1.25">LAST 12 MONTHS · CATEGORY RANK ${escapeXml(stats.contributionRank)}</text>
    <text x="55" y="310" fill="${p.muted}" font-size="13" font-weight="650">Scores shipping activity, not audience size.</text>

    <path d="M430 84V272" stroke="${p.panelBorder}"/>

    <rect x="470" y="82" width="325" height="126" rx="22" fill="${p.panel}" stroke="${p.panelBorder}"/>
    <text x="494" y="159" fill="${p.primary}" font-size="62" font-weight="780" letter-spacing="-2">${escapeXml(stats.pullRequestRank)}</text>
    <text x="590" y="125" fill="${p.text}" font-size="32" font-weight="760">${formatNumber(stats.pullRequests)}</text>
    <text x="590" y="151" fill="${p.text}" font-size="16" font-weight="700" letter-spacing=".4">PULL REQUESTS</text>
    <text x="590" y="177" fill="${p.muted}" font-size="13" font-weight="650">ALL TIME</text>

    <rect x="813" y="82" width="335" height="126" rx="22" fill="${p.panel}" stroke="${p.panelBorder}"/>
    <text x="837" y="159" fill="${p.accent}" font-size="62" font-weight="780" letter-spacing="-2">${escapeXml(stats.issueRank)}</text>
    <text x="933" y="125" fill="${p.text}" font-size="32" font-weight="760">${formatNumber(stats.issues)}</text>
    <text x="933" y="151" fill="${p.text}" font-size="16" font-weight="700" letter-spacing=".4">ISSUES</text>
    <text x="933" y="177" fill="${p.muted}" font-size="13" font-weight="650">ALL TIME</text>

    <text x="470" y="247" fill="${p.muted}" font-size="12" font-weight="700" letter-spacing="1.2">52-WEEK ACTIVITY</text>
  </g>
  <g>${bars}</g>
</svg>
`
}

function renderMobile(stats, theme) {
  const p = palettes[theme]
  const bars = weeklyBars(stats.weeks, {
    x: 36,
    baseline: 505,
    width: 648,
    maxHeight: 76,
    color: p.primary,
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 560" role="img" aria-labelledby="title desc">
  <title id="title">Builder signal: ${escapeXml(stats.contributionRank)} contribution rank</title>
  <desc id="desc">${formatNumber(stats.contributions)} contributions in the last 12 months, ${formatNumber(stats.pullRequests)} pull requests and ${formatNumber(stats.issues)} issues across all time.</desc>
  <defs>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="${p.grid}" stroke-width="1"/>
    </pattern>
    <linearGradient id="rank" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="${p.primary}"/><stop offset="1" stop-color="${p.accent}"/>
    </linearGradient>
  </defs>
  <rect width="720" height="560" rx="25" fill="${p.background}" stroke="${p.border}"/>
  <rect width="720" height="560" rx="25" fill="url(#grid)" opacity=".58"/>

  <g font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <rect x="36" y="30" width="162" height="32" rx="16" fill="${p.primarySoft}" stroke="${p.panelBorder}"/>
    <circle cx="55" cy="46" r="5" fill="${p.primary}"/>
    <text x="68" y="51" fill="${p.primaryText}" font-size="12" font-weight="750" letter-spacing="1.35">BUILDER SIGNAL</text>
    <text x="684" y="51" text-anchor="end" fill="${p.muted}" font-size="11" font-weight="700" letter-spacing=".8">UPDATED ${updatedLabel()}</text>

    <text x="36" y="174" fill="url(#rank)" font-size="108" font-weight="780" letter-spacing="-5">${escapeXml(stats.contributionRank)}</text>
    <text x="260" y="115" fill="${p.text}" font-size="40" font-weight="760">${formatNumber(stats.contributions)}</text>
    <text x="260" y="146" fill="${p.text}" font-size="19" font-weight="720" letter-spacing=".3">CONTRIBUTIONS</text>
    <text x="260" y="175" fill="${p.muted}" font-size="14" font-weight="650">LAST 12 MONTHS · CATEGORY RANK ${escapeXml(stats.contributionRank)}</text>
    <path d="M36 210H684" stroke="${p.panelBorder}"/>

    <rect x="36" y="234" width="312" height="124" rx="22" fill="${p.panel}" stroke="${p.panelBorder}"/>
    <text x="58" y="312" fill="${p.primary}" font-size="60" font-weight="780" letter-spacing="-2">${escapeXml(stats.pullRequestRank)}</text>
    <text x="145" y="278" fill="${p.text}" font-size="31" font-weight="760">${formatNumber(stats.pullRequests)}</text>
    <text x="145" y="306" fill="${p.text}" font-size="15" font-weight="700">PULL REQUESTS</text>
    <text x="145" y="331" fill="${p.muted}" font-size="13" font-weight="650">ALL TIME</text>

    <rect x="372" y="234" width="312" height="124" rx="22" fill="${p.panel}" stroke="${p.panelBorder}"/>
    <text x="394" y="312" fill="${p.accent}" font-size="60" font-weight="780" letter-spacing="-2">${escapeXml(stats.issueRank)}</text>
    <text x="481" y="278" fill="${p.text}" font-size="31" font-weight="760">${formatNumber(stats.issues)}</text>
    <text x="481" y="306" fill="${p.text}" font-size="15" font-weight="700">ISSUES</text>
    <text x="481" y="331" fill="${p.muted}" font-size="13" font-weight="650">ALL TIME</text>

    <text x="36" y="407" fill="${p.muted}" font-size="12" font-weight="700" letter-spacing="1.2">52-WEEK ACTIVITY</text>
    <text x="36" y="537" fill="${p.muted}" font-size="13" font-weight="650">Category ranks score shipping activity, not audience size.</text>
  </g>
  <g>${bars}</g>
</svg>
`
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function fetchGithub() {
  const token = process.env.PROFILE_STATS_TOKEN || process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('Set PROFILE_STATS_TOKEN or GITHUB_TOKEN, or pipe a gh api response with --stdin')
  }

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profile-builder-signal',
    },
    body: JSON.stringify({ query, variables: { login: username } }),
  })

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed with ${response.status}`)
  }

  return response.json()
}

const payload = process.argv.includes('--stdin') ? await readStdin() : await fetchGithub()
const stats = normalize(payload)

await mkdir('assets', { recursive: true })
await Promise.all([
  writeFile('assets/builder-signal-light.svg', renderDesktop(stats, 'light')),
  writeFile('assets/builder-signal-dark.svg', renderDesktop(stats, 'dark')),
  writeFile('assets/builder-signal-mobile-light.svg', renderMobile(stats, 'light')),
  writeFile('assets/builder-signal-mobile-dark.svg', renderMobile(stats, 'dark')),
])

console.log(
  `Generated builder signal for ${username}: ${formatNumber(stats.contributions)} contributions, ${formatNumber(stats.pullRequests)} pull requests, ${formatNumber(stats.issues)} issues (viewer: ${stats.viewer}).`,
)
