// Service URLs are stored with a fixed host (e.g. the Tailscale IP), but the
// dashboard itself may be reached via LAN IP, Tailscale IP, or localhost.
// Swap in whatever host the browser is currently using so links always
// resolve on the same network the user is actually connected through.
export function resolveServiceUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hostname = window.location.hostname
    return u.toString()
  } catch {
    return url
  }
}
