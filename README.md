# vrt

Visual regression testing CLI for AI agents. Wraps [agent-browser](https://github.com/vercel-labs/agent-browser) and [reg-cli](https://github.com/reg-viz/reg-cli).

## Prerequisites

- Node.js >= 18
- [agent-browser](https://github.com/vercel-labs/agent-browser) installed and in PATH

## Install

```bash
git clone https://github.com/horai93/vrt.git
cd vrt
npm install
npm link
```

## Usage

```bash
# Compare two sites (desktop + mobile viewports)
vrt compare https://original.com https://new.com

# Multi-page comparison
vrt compare https://prod.com https://staging.com --pages /,/about,/contact

# Custom viewports
vrt compare https://v1.com https://v2.com --viewports 1280x720,768x1024,375x812

# Take baseline snapshots
vrt snapshot https://example.com ./baseline --pages /,/about

# Diff two saved snapshot directories
vrt diff ./baseline ./current --threshold 0.05
```

## AI Agent Integration

A SKILL.md for cross-harness agent support (pi, Claude Code, Codex) is available at:
[`~/.agents/skills/vrt/SKILL.md`](https://github.com/horai93/vrt)

## Output

- `vrt-output/baseline/` — screenshots of URL 1
- `vrt-output/current/` — screenshots of URL 2
- `vrt-output/diff/` — diff images (red pixels = changes)
- `vrt-output/report/index.html` — HTML report
- Exit code: `0` = pass, `1` = differences detected

## License

MIT
