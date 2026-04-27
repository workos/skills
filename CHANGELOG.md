# Changelog

## [0.5.0](https://github.com/workos/skills/compare/v0.4.0...v0.5.0) (2026-04-27)


### Features

* add FGA, Pipes, Feature Flags, and Radar references + evals ([#19](https://github.com/workos/skills/issues/19)) ([2f57863](https://github.com/workos/skills/commit/2f57863afea497dc56ce3c42b83b4d6124a4646c))

## [0.4.0](https://github.com/workos/skills/compare/v0.3.0...v0.4.0) (2026-04-26)


### Features

* **workos:** add CLI upgrade-path topic and tarball smoke test ([#26](https://github.com/workos/skills/issues/26)) ([5ce9743](https://github.com/workos/skills/commit/5ce9743e49291d5dbb62091eeca1b0f78ea21b07))
* **workos:** close off CLI- and Dashboard-path fabrication ([#23](https://github.com/workos/skills/issues/23)) ([1205e82](https://github.com/workos/skills/commit/1205e82ff90848c875af5a482a7919467acdb3da))


### Bug Fixes

* **workos:** tighten auth guidance and risky eval reruns ([#25](https://github.com/workos/skills/issues/25)) ([dc9dfb0](https://github.com/workos/skills/commit/dc9dfb093cccabafd8d863755ad45f722c2d725d))

## [0.3.0](https://github.com/workos/skills/compare/v0.2.5...v0.3.0) (2026-04-20)


### Features

* **workos:** add terminology reference for docs URL lookups ([#21](https://github.com/workos/skills/issues/21)) ([c66e0d0](https://github.com/workos/skills/commit/c66e0d04c60d1594067bbb270c3b5f3b71a2b3c9))

## [0.2.5](https://github.com/workos/skills/compare/v0.2.4...v0.2.5) (2026-04-13)


### Bug Fixes

* tighten skill descriptions for more reliable triggering ([#17](https://github.com/workos/skills/issues/17)) ([aeadea0](https://github.com/workos/skills/commit/aeadea010ce337fc50bc36ea6e1155a729ef1e2d))

## [0.2.4](https://github.com/workos/skills/compare/v0.2.3...v0.2.4) (2026-03-31)


### Bug Fixes

* harden Next.js AuthKit skill against Server Component cookie violations ([#13](https://github.com/workos/skills/issues/13)) ([21853e2](https://github.com/workos/skills/commit/21853e2cd57984231536b803de562bbce6b3cb36))

## [0.2.3](https://github.com/workos/skills/compare/v0.2.2...v0.2.3) (2026-03-17)


### Bug Fixes

* broaden skill description for more reliable triggering ([#10](https://github.com/workos/skills/issues/10)) ([4340e7e](https://github.com/workos/skills/commit/4340e7ec70e135aa727ee51a0c9738f5cbf4858d))

## [0.2.2](https://github.com/workos/skills/compare/v0.2.1...v0.2.2) (2026-03-09)


### Bug Fixes

* compile TypeScript to dist/ instead of shipping raw .ts ([e23f8f9](https://github.com/workos/skills/commit/e23f8f90191d6360e63193eccdb1c41630f7cb12))

## [0.2.1](https://github.com/workos/skills/compare/v0.2.0...v0.2.1) (2026-03-07)


### Bug Fixes

* add packageManager field for pnpm/action-setup ([ced5ca8](https://github.com/workos/skills/commit/ced5ca8a28ff965f469df2a314777eb1b151cc42))

## [0.2.0](https://github.com/workos/skills/compare/v0.1.0...v0.2.0) (2026-03-07)


### Features

* add --samples=N for eval variance measurement and improve scorer accuracy ([b420a3b](https://github.com/workos/skills/commit/b420a3b5d187561e9b0a1e740be89c9cf67b2310))
* add .claude-plugin with proper plugin.json ([afb7065](https://github.com/workos/skills/commit/afb7065775ce97a0bb5d8ff0aedd181606e35705))
* add AGENTS.md and .cursorrules for cross-platform agent support ([1c5a037](https://github.com/workos/skills/commit/1c5a03701d77c96a0a7a35e79e854707f85c3829))
* add API ref refine prompt, skip FGA, increase refiner token limit ([9174006](https://github.com/workos/skills/commit/91740064f83c6c626a0d7c1c695270a111a9352f))
* add API reference skills, quality gate, and re-refine all skills (Phase 3) ([0e5c9ec](https://github.com/workos/skills/commit/0e5c9ecbd7f07b0e1425186cb714e37ee860bf29))
* add content-addressed locking to skill generation pipeline ([a852248](https://github.com/workos/skills/commit/a852248285d094d2c17a6e196179df26e57ba061))
* add domain rules system and source attribution to refiner ([78eb52f](https://github.com/workos/skills/commit/78eb52f7b6d4beeef6a0be57eb22630410d1e49c))
* add eval transcript tooling — triage report, review labels, save-all-samples ([5004296](https://github.com/workos/skills/commit/5004296b5b54180e1405213394117b5398cfd9dd))
* add marketplace.json for plugin registry discovery ([a11ca30](https://github.com/workos/skills/commit/a11ca3085979a8a67d0ebcb347e571ed7512676d))
* add splitter, generator, and AI refiner pipeline with 28 generated skills ([d0b3d1c](https://github.com/workos/skills/commit/d0b3d1ceb20bf0653d67f21f6cc9bd8d02f54133))
* add transcript diff view and calibration metrics ([a66de91](https://github.com/workos/skills/commit/a66de9167725d1eacca756dfd8df91af23156f81))
* add workos-widgets skill with on-demand OpenAPI spec querying ([#4](https://github.com/workos/skills/issues/4)) ([39269e0](https://github.com/workos/skills/commit/39269e06980354d740029761f7554322fb282bf9))
* consolidate all skills into single-source references ([#6](https://github.com/workos/skills/issues/6)) ([f8a36b4](https://github.com/workos/skills/commit/f8a36b452a6f59bf529911f1534f39d952aab926))
* eval framework for measuring skill effectiveness ([#3](https://github.com/workos/skills/issues/3)) ([beee54a](https://github.com/workos/skills/commit/beee54aa35c170a5184f749d2ec6005ddda76425))
* full pipeline regeneration with improved prompts and rules ([d199dae](https://github.com/workos/skills/commit/d199dae3c2cb042e43e091a11ac1c14468ecc010))
* improve router skill with disambiguation, detection priority, and refinement support ([251bdd9](https://github.com/workos/skills/commit/251bdd9aa1cf32c5b2f4b3a0373e8633acbc032e))
* migrate all skills to content-addressed locking ([6fe2a6d](https://github.com/workos/skills/commit/6fe2a6d1f5e0de1106bda7dcd97aac9324997b3c))
* re-refine all skills with new prompts and rebuilt manifests ([8caca78](https://github.com/workos/skills/commit/8caca787c7d4cc88d1b8f58522e2b863368bc1ce))
* scaffold @workos-inc/skills package with parser, fetcher, and 6 AuthKit skills ([718badf](https://github.com/workos/skills/commit/718badf413f7b31abab65aecfc005eeb9893b684))
* systemic pipeline fixes for quality, accuracy, and stability ([d192b72](https://github.com/workos/skills/commit/d192b7205296a3d023baea49df630dd240b324d6))


### Bug Fixes

* add skills/workos/ subdirectory for installed plugin discovery ([768bd69](https://github.com/workos/skills/commit/768bd69a66b845a7a29b05a077fc14824b10b78a))
* address root causes for 5 low-scoring skills ([74b0260](https://github.com/workos/skills/commit/74b026019c3b1d481924dcfa5a4c796e597d099a))
* improve 5 not-ship-ready skills to pass quality bar ([80016d8](https://github.com/workos/skills/commit/80016d817e0538a50cf2d08f90b7d25bf1bb0228))
* promote dsync webhooks rule to hard gate ([8199a44](https://github.com/workos/skills/commit/8199a447fb047b158a8869b63d1e7687e7270c75))
* remove invalid "category" key from plugin manifests ([5962120](https://github.com/workos/skills/commit/59621207f048189415d2a80a3598a2a81c25760e))
* remove leftover skills/ subdirectory from plugin root ([754e5f5](https://github.com/workos/skills/commit/754e5f5ef6dacffc24c335442dc463c8a1eb7644))
* restore full SKILL.md router content ([07e4931](https://github.com/workos/skills/commit/07e4931fe10b378bc86060a600e4e049e2a44752))
* restructure plugin manifests to match skills.sh marketplace pattern ([76e4d80](https://github.com/workos/skills/commit/76e4d8059cadbd34f962835c6976f82dd5dfe240))
* strip frontmatter from reference files and fix plugin descriptions ([64e9ecc](https://github.com/workos/skills/commit/64e9eccb431030b387da4349acd5d7b5e38df5c8))
