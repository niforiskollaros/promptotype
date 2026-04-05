# Session: Rename, Security Fixes, and v0.1.0 Release

**Date**: 2026-04-05
**Duration**: ~1 hour

## Accomplished

- **Renamed DesignAnnotator to Promptotype** across 28 files — product name, CLI binary, CSS prefixes (da- → pt-), proxy routes, window globals, slash command file
- **Renamed GitHub repo** from SignalOrg/designottaror to SignalOrg/promptotype, then migrated to niforiskollaros/promptotype (public, personal account)
- **Fixed 3 security issues** from Codex adversarial review:
  - Session token auth on proxy annotation endpoint (crypto.randomUUID per session)
  - CSP compatibility — replaced inline script with served bootstrap.js, strip CSP headers
  - Honest submit UI — await async result before showing success/error state
- **Merged feature/plugin_architecture to main** (fast-forward, 4 commits)
- **Built release binaries** for 4 platforms (darwin-arm64/x64, linux-arm64/x64)
- **Published v0.1.0 release** on GitHub with all binaries
- **Tested install script end-to-end** — binary downloads, installs, slash commands register, --help works
- **Rewrote README** with install instructions, CLI usage, architecture summary
- **Set up GitHub Actions CI** — push a tag, get a release with 4 binaries automatically (18s build)
- **Published to npm** as promptotype@0.1.0 with postinstall binary downloader
- **Deployed landing page** to Vercel at locusai.design with install.sh rewrite

## Key Decisions

- **Personal repo over enterprise**: Enterprise repo (SignalOrg) is private, can't serve public release assets. Moved to niforiskollaros/promptotype as the public distribution repo.
- **Session token for proxy security**: Each proxy session generates a UUID, injected via bootstrap.js, required on annotation POST. Prevents forged submissions from scripts on the proxied page.
- **CSP workaround**: Strip CSP headers from proxied responses + serve bootstrap as external JS file instead of inline script. Pragmatic for a dev-only tool.
- **npm binary distribution**: Postinstall script downloads the platform-specific binary from GitHub releases (like esbuild pattern), thin Node.js wrapper execs it.

## Files Changed

| Action | Path | Description |
|--------|------|-------------|
| Modified | `cli/server.ts` | Session token, bootstrap.js route, CSP stripping |
| Modified | `src/output.ts` | Include session token in proxy submissions |
| Modified | `src/review-panel.ts` | Async-aware submit button with success/error states |
| Modified | `src/index.ts` | onCopy returns Promise<boolean> |
| Modified | `package.json` | npm publish config, bin, files, postinstall |
| Modified | `install.sh` | Fixed repo to niforiskollaros/promptotype |
| Modified | `CLAUDE.md` | Updated repo URL, prefix docs |
| Modified | `README.md` | Full rewrite for v0.1.0 |
| Renamed | `cli/design-annotate.md` → `cli/promptotype.md` | Slash command file |
| Created | `.github/workflows/release.yml` | CI: build + release on tag push |
| Created | `npm/postinstall.js` | Downloads platform binary from GitHub release |
| Created | `npm/cli.js` | Thin wrapper to exec downloaded binary |
| Created | `.npmignore` | Exclude source/cli/design files from npm |
| Created | `site/index.html` | Landing page for locusai.design |
| Created | `site/vercel.json` | Rewrite /install.sh to raw GitHub |
| Modified | All src/*.ts, .design/*, sessions/* | DesignAnnotator → Promptotype rename |

## Next Steps

- [ ] MCP server + browser extension (Phase 4) — seamless multi-agent support
- [ ] Screenshot capture per annotation
- [ ] Design token mapping (Tailwind detection)
- [ ] Component detection (React/Vue)
- [ ] Figma comparison mode

## Notes

- Codex adversarial review was useful for catching the unauthenticated proxy endpoint — worth running before releases
- The enterprise repo (SignalOrg/promptotype) still exists but is private; user will delete it manually
- gh auth needed `workflow` scope to push GitHub Actions files
- npm package is 17.7KB, binary download happens on postinstall
- CI builds all 4 platform binaries in ~18 seconds

---
*Session documented with wrap-up skill*
