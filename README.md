# vrt

Visual regression testing CLI for AI agents. Wraps [agent-browser](https://github.com/vercel-labs/agent-browser) and [reg-cli](https://github.com/reg-viz/reg-cli).

## Install

```bash
git clone https://github.com/horai93/vrt.git
cd vrt
npm install
npm link
```

Requires `agent-browser` to be installed.

## Usage

```bash
# Compare two sites (desktop + mobile)
vrt compare https://original.com https://new.com

# Multi-page
vrt compare https://prod.com https://staging.com --pages /,/about,/contact

# Take snapshots
vrt snapshot https://example.com ./baseline --pages /,/about

# Diff saved snapshots
vrt diff ./baseline ./current
```

## AI Agent Integration

Place the SKILL.md in `~/.agents/skills/vrt/` for cross-harness AI agent support (pi, Claude Code, Codex).

## Output

- `vrt-output/diff/` — diff images (red pixels = changes)
- `vrt-output/report/index.html` — HTML report
- Exit code 0 = pass, 1 = differences detected
