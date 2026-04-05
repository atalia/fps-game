# FPS Productization Roadmap Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the FPS project from a feature-rich prototype into a stable, replayable product by prioritizing regression coverage, multiplayer feel, team voice, telemetry, and operational docs.

**Architecture:** The work is split into independent but ordered tracks: regression safety net, network/gamefeel improvements, team communication, telemetry, and documentation. Each track maps to concrete GitHub issues with explicit file targets, test expectations, and acceptance criteria so implementation can proceed in parallel where safe.

**Tech Stack:** Go, WebSocket, Three.js/browser JS, Playwright, GitHub Actions, gh CLI

---

## Chunk 1: Issue Breakdown

### Issue 1: Build core regression suite for round/economy/bomb flows
- Focus areas:
  - Buy menu and economy lifecycle
  - Round start / round end / side switch / overtime
  - Bomb plant / defuse / win conditions
- Candidate files:
  - `e2e/multiplayer.spec.ts`
  - `server/internal/economy/economy_test.go`
  - `server/internal/network/economy_test.go`
  - `server/internal/room/round_manager_test.go`
  - `shared/schemas/round_started.json`
  - `shared/schemas/round_ended.json`
- Expected outcome:
  - Core CS-style loop covered by stable tests

### Issue 2: Expand protocol contract and fuzz coverage for WebSocket messages
- Focus areas:
  - Protocol schema drift prevention
  - Invalid payload handling
  - Voice / grenade / match state message validation
- Candidate files:
  - `server/internal/protocol/schema_test.go`
  - `server/internal/network/fuzz_test.go`
  - `server/internal/network/message_test.go`
  - `client/js/__tests__/protocol.test.js`
  - `shared/schemas/*.json`
- Expected outcome:
  - Message-level regressions caught before deploy

### Issue 3: Harden CI with deterministic regression gates
- Focus areas:
  - Split fast tests, race tests, E2E, mobile tests
  - Fail loudly on critical regressions
  - Keep expensive checks isolated and understandable
- Candidate files:
  - `.github/workflows/ci.yml`
  - `scripts/pre-deploy-check.sh`
  - `scripts/pre-commit.sh`
  - `Makefile`
- Expected outcome:
  - A predictable release gate instead of ad hoc validation

### Issue 4: Improve player sync, interpolation, and network-state UX
- Focus areas:
  - Remote player movement smoothing
  - Snapshot interpolation strategy
  - Connection quality indicator / degraded-state UI
- Candidate files:
  - `client/js/network.js`
  - `client/js/player.js`
  - `client/js/game-loop.js`
  - `client/js/ui.js`
  - `server/internal/network/server.go`
- Expected outcome:
  - Remote player movement feels less jittery and easier to track

### Issue 5: Tighten hit feedback, reconnect, and multiplayer recovery paths
- Focus areas:
  - Hit confirmation consistency
  - Death / respawn / spectate transitions
  - Reconnect or transient disconnect recovery
- Candidate files:
  - `client/js/effects.js`
  - `client/js/ui.js`
  - `client/js/network.js`
  - `server/internal/network/regression_test.go`
  - `server/internal/network/multiplayer_test.go`
- Expected outcome:
  - Multiplayer state transitions feel robust instead of fragile

### Issue 6: Complete team voice chat pipeline and controls
- Focus areas:
  - Push-to-talk / open-mic mode selection
  - Team-only routing rules
  - Speaking-state indicators
- Candidate files:
  - `client/js/voice.js`
  - `client/js/audio.js`
  - `client/js/team.js`
  - `shared/schemas/voice_start.json`
  - `shared/schemas/voice_data.json`
- Expected outcome:
  - Voice becomes reliable enough for actual team coordination

### Issue 7: Add mobile-friendly voice and communication UX
- Focus areas:
  - Microphone permission flow on mobile
  - Touch UI for speaking / muting
  - Horizontal layout compatibility
- Candidate files:
  - `client/js/mobile-controls.js`
  - `client/js/voice.js`
  - `client/tests/mobile.test.js`
  - `client/tests/audio.test.js`
- Expected outcome:
  - Team comms remain usable on phones, not desktop-only

### Issue 8: Add gameplay telemetry for retention and balancing decisions
- Focus areas:
  - Join success rate
  - Match duration
  - Disconnect rate
  - Mode / weapon usage
  - Mobile vs desktop usage
- Candidate files:
  - `server/pkg/metrics/*`
  - `server/internal/network/server.go`
  - `server/internal/room/state.go`
  - `client/js/network.js`
- Expected outcome:
  - Product decisions can be driven by observed usage instead of intuition

### Issue 9: Use telemetry to run first weapon/economy/bot balance pass
- Focus areas:
  - Weapon pick rate / win rate review
  - Economy pacing review
  - Bot pressure and fairness tuning
- Candidate files:
  - `server/internal/economy/economy.go`
  - `server/internal/weapon/weapon.go`
  - `server/internal/ai/*`
  - `client/js/weapons.js`
- Expected outcome:
  - Match pacing becomes more competitive and less random

### Issue 10: Document architecture, protocol, deployment, and troubleshooting
- Focus areas:
  - Architecture overview
  - Message flow diagrams
  - Deploy/runbook
  - Common failure scenarios
- Candidate files:
  - `README.md`
  - `docs/**`
  - `scripts/pre-deploy-check.sh`
- Expected outcome:
  - Future iteration and handoff become much cheaper
