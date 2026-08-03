# Builder signal methodology

The Builder Signal uses separate category ranks instead of one overall GitHub grade. It measures visible work, not the size of an audience.

## What the card measures

- **Contributions:** GitHub's contribution total for the trailing 12 months. When private contributions are enabled on the profile, GitHub includes their counts without exposing repository names or other private details.
- **Pull requests:** the all-time total visible to the token that generates the card.
- **Issues:** the all-time total visible to that token.

Stars and followers are intentionally excluded. They measure distribution and popularity, which are useful signals, but they are not the activity this card is designed to show.

## Category ranks

The thresholds come from the open-source [GitHub Profile Trophy](https://github.com/ryo-ma/github-profile-trophy/blob/master/src/trophy.ts) project. Each category receives its own rank.

| Rank | Contributions | Pull requests and issues |
| --- | ---: | ---: |
| SSS | 4,000 | 1,000 |
| SS | 2,000 | 500 |
| S | 1,000 | 200 |
| AAA | 500 | 100 |
| AA | 200 | 50 |
| A | 100 | 20 |
| B | 10 | 10 |
| C | 1 | 1 |

The upstream project calls its first category "Commits" and adds GitHub's restricted contribution count. This card instead reads `contributionCalendar.totalContributions` and labels the number **Contributions**, which is what GitHub actually reports.

GitHub documents that publicized private activity exposes contribution counts, not private repository details. See [GitHub's profile contributions reference](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference).

## Updates and token visibility

The workflow regenerates the SVG files daily. Add a repository secret named `PROFILE_STATS_TOKEN` to include private pull request and issue totals. A fine-grained token should receive read-only access only to the repositories that need to be counted. Without that secret, the workflow falls back to the repository's `GITHUB_TOKEN` and can still render public activity plus anonymized private contribution counts exposed by the profile setting.

The values, activity chart, update date, and resulting category ranks are dynamic. The thresholds above stay fixed so the meaning of a rank does not quietly change. Because Contributions uses a trailing 12-month window, that score can rise or fall as days enter and leave the window. Pull request and issue totals are all-time counts and will normally only rise, subject to repository visibility and deletion.
