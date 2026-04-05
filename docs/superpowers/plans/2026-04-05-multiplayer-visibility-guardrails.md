# Multiplayer Visibility & AI Perception Guardrails

> Scope: Prevent regressions where players/bots exist in room state but are invisible to clients or invisible to AI targeting logic.

## Execution Checklist

### Phase 1: Close current live regressions
- [x] Renderer preserves server-provided Y when adding remote players/bots
- [x] Renderer preserves server-provided Y when updating remote players/bots
- [x] Add frontend regression tests for remote entity Y-coordinate preservation
- [x] Verify frontend protocol/handler tests still pass
- [x] Verify backend AI tests still pass after current bot-targeting fix

### Phase 2: Add prevention tests
- [x] Add backend test ensuring AI target selection includes enemy bots
- [x] Add backend test ensuring AI target selection excludes same-team bots/players
- [x] Add backend test ensuring AI ignores dead entities
- [ ] Add frontend test covering player_respawned path preserving visible position
- [ ] Add smoke test plan for 2-player mutual visibility and bot-vs-bot interaction

### Phase 3: Improve observability
- [ ] Add lightweight debug instrumentation for remote entity spawn/update positions
- [ ] Add lightweight AI targeting debug logs for target type/team selection
- [ ] Document visibility debugging workflow (protocol vs renderer vs AI)

## Verification Gates
- [x] `npm test -- client/js/__tests__/renderer.test.js client/js/__tests__/handlers.test.js client/js/__tests__/protocol.test.js`
- [x] `~/.local/go/bin/go test ./internal/ai ./internal/network ./internal/room`
- [ ] Manual browser check: two clients can see each other
- [ ] Manual browser check: bots are visible and bot-vs-bot combat can occur
