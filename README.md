# vrt

Visual regression testing CLI for AI agents. Compares two URLs with DOM diff + pixel diff across multiple viewports.

Built on [agent-browser](https://github.com/vercel-labs/agent-browser) (screenshots, DOM diff) and [reg-cli](https://github.com/reg-viz/reg-cli) (pixel diff, HTML report).

## Prerequisites

- Node.js >= 18
- [agent-browser](https://github.com/vercel-labs/agent-browser) installed globally

```bash
# Install agent-browser if you don't have it
npm i -g agent-browser
agent-browser install  # downloads Chrome
```

## Install

```bash
git clone https://github.com/horai93/vrt.git
cd vrt
npm install
npm link
```

Verify: `vrt --version`

## Usage

```bash
# Compare two sites (desktop 1280x720 + mobile 375x812)
vrt compare https://original.com https://new.com

# Multiple pages
vrt compare https://prod.com https://staging.com --pages /,/about,/contact

# Custom viewports
vrt compare https://v1.com https://v2.com --viewports 1280x720,768x1024,375x812

# Adjust pixel sensitivity (0 = exact, 0.05 = lenient)
vrt compare https://a.com https://b.com --threshold 0.05

# Save baseline snapshots
vrt snapshot https://example.com ./baseline --pages /,/about

# Diff two saved snapshot directories
vrt diff ./baseline ./current
```

## Output

```
vrt-output/
├── baseline/       # Screenshots of URL 1
├── current/        # Screenshots of URL 2
├── diff/           # Diff images (red = changed pixels)
├── report/
│   └── index.html  # Interactive HTML report
└── reg.json        # Machine-readable results
```

Exit code: `0` = all passed, `1` = differences detected.

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--pages` | `/` | Comma-separated page paths |
| `--viewports` | `1280x720,375x812` | Comma-separated WxH specs |
| `--threshold` | `0` | Pixel matching threshold (0–1) |
| `--delay` | `2000` | Wait ms after page load |
| `--wait-until` | `networkidle` | Navigation wait strategy |
| `--out` | `./vrt-output` | Output directory |
| `--json` | off | Print JSON results to stdout |
| `--no-full` | off | Viewport-only (skip full-page scroll) |

## AI Agent Skill

A [SKILL.md](https://github.com/horai93/vrt) for cross-harness agent support is included.
Copy it to your skills directory:

```bash
cp -r /path/to/vrt/skills/vrt ~/.agents/skills/vrt
```

Works with pi, Claude Code, Codex — any harness that reads `~/.agents/skills/`.

## License

MIT
