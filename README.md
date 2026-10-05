# pi-gpt

GPT fast mode for [Pi](https://pi.dev), extracted from `gpt-fast-mode.ts`.

Run `/fast` to toggle priority processing for an explicit list of models. The extension adds `service_tier: "priority"` to matching requests and displays `fast` in the status bar. Provider support and account eligibility determine the actual processing tier and charges.

## Install

Install from npm:

```sh
pi install npm:@likelz/pi-gpt
```

Or from GitHub:

```sh
pi install git:github.com/ekil1100/pi-gpt
```

Or from a local checkout:

```sh
bun install
pi install /absolute/path/to/pi-gpt
```

The package exposes TypeScript source through its Pi manifest, so local and Git installations work without a build step. Disable or move the original `~/.pi/agent/extensions/gpt-fast-mode.ts` outside the extensions directory before loading this package to avoid registering `/fast` twice. Rename its JSON configuration to `pi-gpt.json`.

## Configure

Edit `~/.pi/agent/extensions/pi-gpt.json` (under `PI_CODING_AGENT_DIR` when overridden):

```json
{
  "enabled": false,
  "models": ["openai/gpt-6-astra"]
}
```

Use the exact `provider/model` identifiers shown by Pi, including any additional slashes in a model ID. The list starts empty; add models whose endpoint supports priority processing. Restart Pi or reload extensions after editing the file.

- `/fast` toggles and persists `enabled`.
- Unlisted models and disabled mode leave requests unchanged.
- Missing or invalid configuration starts with fast mode off and an empty list. Invalid configuration produces a warning.
- A failed save leaves the in-memory state unchanged.
- The status indicates the requested mode. It does not confirm the provider's actual processing tier.

## Ultrafast

This extension requests **priority**, preserving the original behavior. OpenAI also documents `service_tier: "ultrafast"` for GPT-6 Astra in the Responses API. That is a separate tier with separate eligibility and pricing.

- **API key:** API billing and rate limits apply independently of ChatGPT subscriptions. The official guide says GPT-6 Astra Ultrafast is available to all API users at low limits; its published allowance table covers usage tiers 1–5.
- **Codex subscription:** Pro $500/month and eligible Enterprise/Edu plans have Ultrafast access. Other self-serve plans do not gain access by purchasing credits.
- A third-party proxy must support and forward the tier. This package does not verify account eligibility or enable Ultrafast.

Sources: [Ultrafast API](https://developers.openai.com/api/docs/guides/ultrafast-mode), [Fast API](https://developers.openai.com/api/docs/guides/fast-mode), [Codex speed and eligibility](https://learn.chatgpt.com/docs/agent-configuration/speed), [Codex pricing](https://learn.chatgpt.com/docs/pricing).

## Publishing

[Publish to npm](https://github.com/ekil1100/pi-gpt/actions/workflows/publish.yml) uses GitHub Actions OIDC. It needs no npm token secret. Node.js 24, npm 11.19.0, and Bun 1.4.2 are configured in the workflow. The `prepublishOnly` script runs checks, tests, and the build before publishing.

Configure a GitHub Actions trusted publisher in the [npm package settings](https://www.npmjs.com/package/@likelz/pi-gpt/access):

| Field                | Value                                      |
| -------------------- | ------------------------------------------ |
| Organization or user | `ekil1100`                                 |
| Repository           | `pi-gpt`                                   |
| Workflow filename    | `publish.yml`                              |
| Environment name     | Leave empty                                |
| Allowed actions      | Allow direct publishing with `npm publish` |

Run the workflow manually to check installation, validation, and tarball contents without uploading. This dry run does not verify npm's OIDC trust configuration; that is exercised by an actual release.

To release, update `package.json` to a new stable version, commit and push it, then push a matching tag such as `v0.1.1`. The workflow rejects tags that do not match the package version. Version `0.1.0` is already published and cannot be republished. OIDC publishing automatically includes provenance for this public repository and package.

## Development

Use Bun 1.4.2 and Vite+ 1.0.0. Development was verified on Node.js 24.

```sh
vp install
vp check
vp test run
vp pack
```

`vp pack` builds the ESM library and declarations in `dist/`. `vp run build` runs the package's build script; `vp dev` starts Vite's application server and is not used for this extension. Pi supplies its host package at runtime; Effect is a runtime dependency.

The implementation uses pure functions for state validation and request transformation, Effect for file I/O and failure handling, and a small Pi adapter for commands and events. Tests use temporary directories and make no model requests.
