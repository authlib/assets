import { rename, writeFile } from 'node:fs/promises'

const projects = [
  { slug: 'authlib', repository: 'authlib/authlib', packageName: 'authlib' },
  { slug: 'joserfc', repository: 'authlib/joserfc', packageName: 'joserfc' },
  { slug: 'otpauth', repository: 'authlib/otpauth', packageName: 'otpauth' },
]

const githubToken = process.env.GITHUB_TOKEN || process.env.SPONSORKIT_GITHUB_TOKEN
const userAgent = 'authlib-assets (+https://github.com/authlib/assets)'

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function fetchResponse(url, headers = {}) {
  let lastError

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': userAgent,
          ...headers,
        },
        signal: AbortSignal.timeout(10_000),
      })

      if (response.ok) return response

      const error = new Error(`${url} returned ${response.status}`)
      lastError = error

      const retryAfter = Number(response.headers.get('retry-after'))
      if (attempt < 2) {
        await wait(Number.isFinite(retryAfter) ? retryAfter * 1000 : (attempt + 1) * 1000)
      }
    } catch (error) {
      lastError = error
      if (attempt < 2) await wait((attempt + 1) * 1000)
    }
  }

  throw lastError
}

async function fetchJson(url, headers = {}) {
  const response = await fetchResponse(url, headers)
  return response.json()
}

async function fetchHtml(url) {
  const response = await fetchResponse(url, { Accept: 'text/html' })
  return response.text()
}

function readMetric(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`Invalid ${label}: ${value}`)
  }
  return value
}

function readMonthlyDownloads(html, project) {
  const match = html.match(/Downloads last month:\s*([\d,]+)/i)
  if (!match) {
    throw new Error(`Monthly downloads not found for ${project.slug}`)
  }

  return readMetric(
    Number(match[1].replaceAll(',', '')),
    `${project.slug} monthly downloads`,
  )
}

async function getProjectMetrics(project) {
  const githubHeaders = {
    Accept: 'application/vnd.github+json',
    ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
  }
  const repository = await fetchJson(
    `https://api.github.com/repos/${project.repository}`,
    githubHeaders,
  )
  const downloadsPage = await fetchHtml(
    `https://pypistats.org/packages/${encodeURIComponent(project.packageName)}`,
  )

  return {
    slug: project.slug,
    stars: readMetric(repository.stargazers_count, `${project.slug} stars`),
    monthlyDownloads: readMonthlyDownloads(downloadsPage, project),
  }
}

const outputUrl = new URL('../project-metrics.json', import.meta.url)
const temporaryUrl = new URL('../project-metrics.json.tmp', import.meta.url)
const metrics = []

for (const project of projects) {
  metrics.push(await getProjectMetrics(project))
}

const output = `${JSON.stringify({
  updatedAt: new Date().toISOString(),
  projects: metrics,
}, null, 2)}\n`

await writeFile(temporaryUrl, output)
await rename(temporaryUrl, outputUrl)
