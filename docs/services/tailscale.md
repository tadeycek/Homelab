# Tailscale

> Mesh VPN that gives secure remote access to the server without opening ports.

| | |
|---|---|
| Status | Running as a **host** service (`tailscaled`), not a container |
| Address | Tailscale address of the node named `homelab` |
| Defined in | Not in this repo. Documented in [host setup](../host-setup.md#tailscale) |
| Image | Installed from Tailscale's package repository |
| Data | Managed by `tailscaled` on the host |

## What it does

- Connects this server, your PC and phone into one private network. Any service can be reached over it as if you were at home.

## Why it is here

- It replaces port forwarding for remote access, so services do not need to be exposed to the internet.
- It is documented here because the [dashboard](dashboard.md) and the runbook depend on it, even though it is not a container.

## How it is set up

- Installed directly on the host and run as the `tailscaled` systemd service (version 1.102.3 at the time of writing).
- The dashboard mounts `/var/run/tailscale` read-only to display peer status.
- `TS_AUTHKEY` in `.env.example` is provided for unattended joins with an auth key; the current node was not necessarily joined that way.

## First run

- Install Tailscale, run `sudo tailscale up`, sign in, and approve the device in the Tailscale admin console.

## Data and backups

- Node identity is held in `/var/lib/tailscale` on the host and is **not** backed up by `scripts/backup.sh`. After a rebuild the node re-registers as a new device.

## Operating notes

- Tailscale addresses (`100.x.y.z`) are only reachable from inside your tailnet. The dashboard defaults contain one; see the note there.
- Because access is over Tailscale, you can leave the admin UIs of internal services off the public internet.

## Related

- [Dashboard](dashboard.md), [Host setup](../host-setup.md)
