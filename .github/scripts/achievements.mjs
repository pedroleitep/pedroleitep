// Builds achievements.svg: the real GitHub achievements scraped from the
// profile page plus milestone tiles computed from the GitHub API.
import fs from 'node:fs';

const user = process.env.USERNAME ?? 'pedroleitep';
const token = process.env.GITHUB_TOKEN;
const out = process.argv[2] ?? 'achievements.svg';
const headers = { 'User-Agent': 'profile-achievements', ...(token && { Authorization: `bearer ${token}` }) };

const C = { bg: '#0d1117', card: '#161b22', border: '#30363d', text: '#e6edf3', muted: '#8b949e', purple: '#5817fc', violet: '#7c3aed', lilac: '#a78bfa' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- real GitHub achievements ----------
async function githubAchievements() {
  const html = await fetch(`https://github.com/${user}?tab=achievements`, { headers: { 'User-Agent': headers['User-Agent'] } }).then((r) => r.text());
  const found = new Map();
  for (const m of html.matchAll(/<img src="(https:\/\/github\.githubassets\.com\/assets\/[^"]+\.png)"[^>]*alt="Achievement: ([^"]+)"[^>]*achievement-badge-card/g)) {
    const [, src, name] = m;
    if (found.has(name)) continue;
    const tier = { bronze: 'x2', silver: 'x3', gold: 'x4' }[src.match(/-(bronze|silver|gold)-/)?.[1]] ?? '';
    const png = Buffer.from(await fetch(src).then((r) => r.arrayBuffer())).toString('base64');
    found.set(name, { name, tier, img: `data:image/png;base64,${png}` });
  }
  return [...found.values()];
}

// ---------- stats from the API ----------
async function stats() {
  const query = `query($login: String!) {
    user(login: $login) {
      createdAt
      followers { totalCount }
      following { totalCount }
      starredRepositories { totalCount }
      pullRequests { totalCount }
      issues { totalCount }
      repositoriesContributedTo(contributionTypes: [COMMIT, PULL_REQUEST, ISSUE]) { totalCount }
      repositories(first: 100, ownerAffiliations: OWNER) {
        totalCount
        nodes { stargazerCount forkCount languages(first: 20) { nodes { name } } }
      }
    }
  }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: user } }),
  }).then((r) => r.json());
  if (res.errors) throw new Error(JSON.stringify(res.errors));
  const u = res.data.user;

  const search = await fetch(`https://api.github.com/search/commits?q=author:${user}&per_page=1`, {
    headers: { ...headers, Accept: 'application/vnd.github+json' },
  }).then((r) => r.json());

  const repos = u.repositories.nodes;
  const langs = new Set(repos.flatMap((r) => r.languages.nodes.map((l) => l.name)));
  const years = (Date.now() - new Date(u.createdAt)) / (365.25 * 24 * 3600 * 1000);
  return {
    commits: search.total_count ?? 0,
    repos: u.repositories.totalCount,
    langs: langs.size,
    prs: u.pullRequests.totalCount,
    followers: u.followers.totalCount,
    stars: u.starredRepositories.totalCount,
    contributed: u.repositoriesContributedTo.totalCount,
    years,
  };
}

// ---------- rendering ----------
const RANKS = ['C', 'B', 'A', 'S'];
function rank(value, thresholds) {
  let i = -1;
  while (i + 1 < thresholds.length && value >= thresholds[i + 1]) i++;
  const next = thresholds[i + 1];
  const prev = i >= 0 ? thresholds[i] : 0;
  return { label: i >= 0 ? RANKS[i] : '-', progress: next ? (value - prev) / (next - prev) : 1, next };
}

const ICONS = {
  commit: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM2 12h6M16 12h6',
  repo: 'M5 4h11l3 3v13H5zM9 9h6M9 13h6M9 17h3',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  pr: 'M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 21V9a4 4 0 0 0-4-4h-3M13 2l-3 3 3 3',
  people: 'M9 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 20c0-4 12-4 12 0M16 5a3 3 0 0 1 0 6M18 14c2 .5 3 2 3 4',
  star: 'M12 3l2.8 5.8 6.2.9-4.5 4.3 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.7l6.2-.9z',
  handshake: 'M3 12l4-4 5 5 5-5 4 4M7 16l3 3M11 16l3 3M14 13l3 3',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 3',
};

function tile(x, y, { title, value, icon, r }) {
  const color = { S: C.lilac, A: C.lilac, B: C.purple, C: C.violet, '-': C.muted }[r.label];
  const bar = 150 * Math.max(0.04, Math.min(1, r.progress));
  return `<g transform="translate(${x},${y})">
    <rect width="230" height="84" rx="10" fill="${C.card}" stroke="${C.border}"/>
    <circle cx="38" cy="38" r="24" fill="${color}22" stroke="${color}" stroke-width="2"/>
    <g transform="translate(26,26)"><path d="${ICONS[icon]}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>
    <text x="74" y="30" fill="${C.text}" font-size="15" font-weight="600">${esc(title)}</text>
    <text x="74" y="50" fill="${C.muted}" font-size="12">${esc(value)}</text>
    <rect x="74" y="62" width="150" height="5" rx="2.5" fill="${C.border}"/>
    <rect x="74" y="62" width="${bar.toFixed(1)}" height="5" rx="2.5" fill="${color}"/>
    <rect x="192" y="12" width="26" height="20" rx="5" fill="${color}"/>
    <text x="205" y="27" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">${r.label}</text>
  </g>`;
}

function badge(x, y, a) {
  return `<g transform="translate(${x},${y})">
    <rect width="230" height="84" rx="10" fill="${C.card}" stroke="${C.border}"/>
    <image href="${a.img}" x="10" y="8" width="68" height="68"/>
    <text x="88" y="38" fill="${C.text}" font-size="15" font-weight="600">${esc(a.name)}</text>
    <text x="88" y="58" fill="${C.muted}" font-size="12">GitHub achievement</text>
    ${a.tier ? `<rect x="192" y="52" width="26" height="20" rx="5" fill="#b87333"/><text x="205" y="67" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">${a.tier}</text>` : ''}
  </g>`;
}

const [earned, s] = await Promise.all([githubAchievements(), stats()]);
const milestones = [
  { title: 'Developer', icon: 'commit', value: `${s.commits} commits pushed`, r: rank(s.commits, [100, 500, 1000, 5000]) },
  { title: 'Maintainer', icon: 'repo', value: `${s.repos} repositories`, r: rank(s.repos, [5, 15, 30, 60]) },
  { title: 'Polyglot', icon: 'globe', value: `${s.langs} languages used`, r: rank(s.langs, [3, 6, 10, 15]) },
  { title: 'Collaborator', icon: 'pr', value: `${s.prs} pull requests`, r: rank(s.prs, [1, 10, 50, 200]) },
  { title: 'Influencer', icon: 'people', value: `${s.followers} followers`, r: rank(s.followers, [5, 20, 50, 200]) },
  { title: 'Stargazer', icon: 'star', value: `${s.stars} repos starred`, r: rank(s.stars, [5, 20, 50, 200]) },
  { title: 'Contributor', icon: 'handshake', value: `${s.contributed} repos contributed to`, r: rank(s.contributed, [1, 5, 15, 40]) },
  { title: 'Veteran', icon: 'clock', value: `${s.years.toFixed(1)} years on GitHub`, r: rank(s.years, [1, 2, 4, 8]) },
];

const cols = 4, w = 245, h = 96, pad = 20;
const items = [...earned.map((a) => ({ a })), ...milestones.map((m) => ({ m }))];
const rows = Math.ceil(items.length / cols);
const height = pad * 2 + rows * h - 12;
const body = items
  .map((it, i) => {
    const x = pad + (i % cols) * w, y = pad + Math.floor(i / cols) * h;
    return it.a ? badge(x, y, it.a) : tile(x, y, it.m);
  })
  .join('\n');

fs.writeFileSync(
  out,
  `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif">
  <rect width="1000" height="${height}" rx="8" fill="${C.bg}"/>
  ${body}
</svg>\n`,
);
console.log(`wrote ${out}: ${earned.length} GitHub achievements, ${milestones.length} milestones`, s);
