// UI Manager - 界面管理
class UIManager {
  constructor() {
    this.elements = {};
    this.selfPlayerId = null;
    this.lastMoneyValue = null;
    this.moneyAnimationTimer = null;
    this.moneyDeltaTimer = null;
    this.hitMarkerTimer = null;
    this.crosshairHitTimer = null;
    this.killConfirmationTimer = null;
    this.bridgeInterval = null;
    this.bridgeAttempts = 0;
    this.runtimeSyncInterval = null;
    this.crosshairColorKey = this.loadStoredCrosshairColor();
    this.lastSyncedWeapon = "";
    this.lastSyncedTeam = "";

    this.initElements();
    this.lastMoneyValue = this.parseCurrency(this.elements.money?.textContent);
    this.bindCrosshairColorPicker();
    this.startRuntimeSync();
    const remainingBridges = this.installExternalFeedbackBridges();
    if (remainingBridges > 0) {
      this.startBridgePolling();
    }
  }

  initElements() {
    this.elements = {
      healthBar: document.getElementById("health-bar"),
      healthFill: document.getElementById("health-fill"),
      healthText: document.getElementById("health-text"),
      armorBar: document.getElementById("armor-bar"),
      armorFill: document.getElementById("armor-fill"),
      armorText: document.getElementById("armor-text"),
      armorStateText: document.getElementById("armor-state-text"),
      money: document.getElementById("money-amount"),
      moneyChange: document.getElementById("money-change"),
      ammoDisplay: document.getElementById("ammo-display"),
      ammo: document.getElementById("ammo-count"),
      ammoReserve: document.getElementById("ammo-reserve"),
      currentWeapon: document.getElementById("current-weapon"),
      weaponIcon: document.getElementById("weapon-icon"),
      roomId: document.getElementById("room-id"),
      playerCount: document.getElementById("player-count"),
      playersContainer: document.getElementById("players-container"),
      connectionStatus: document.getElementById("connection-status"),
      chatMessages: document.getElementById("chat-messages"),
      chatInput: document.getElementById("chat-input"),
      killFeed: document.getElementById("kill-feed"),
      scoreboard: document.getElementById("scoreboard"),
      scoreboardBody: document.getElementById("scoreboard-rows"),
      scoreboardTeamSummary: document.getElementById("scoreboard-team-summary"),
      scoreboardMvp: document.getElementById("scoreboard-mvp"),
      roundPanel: document.getElementById("round-panel"),
      roundNumber: document.getElementById("round-number"),
      roundScore: document.getElementById("round-score"),
      ctScore: document.getElementById("ct-score"),
      tScore: document.getElementById("t-score"),
      roundTimer: document.getElementById("round-timer"),
      roundPhase: document.getElementById("round-phase"),
      selfTeamIndicator: document.getElementById("self-team-indicator"),
      minimapTeamLabel: document.getElementById("minimap-team-label"),
      crosshair: document.getElementById("crosshair"),
      crosshairColorOptions: Array.from(
        document.querySelectorAll(".crosshair-color-option"),
      ),
      hitMarker: document.getElementById("hit-marker"),
      hitMarkerLabel: document.getElementById("hit-marker-label"),
      damageDirectionIndicator: document.getElementById(
        "damage-direction-indicator",
      ),
      killConfirmation: document.getElementById("kill-confirmation"),
    };
  }

  setSelfPlayerId(id) {
    this.selfPlayerId = id;
    this.syncSelfTeamHud();
  }

  updatePlayerList(players) {
    if (!this.elements.playersContainer) return;

    this.elements.playersContainer.innerHTML = "";

    if (typeof window !== "undefined") {
      window.__playerListDebug = window.__playerListDebug || [];
      window.__playerListDebug.push({
        at: Date.now(),
        selfPlayerId: this.selfPlayerId,
        players: (players || []).map((player) => ({
          id: player.id,
          name: player.name,
          team: player.team,
          is_bot: !!player.is_bot,
        })),
      });
      if (window.__playerListDebug.length > 50) {
        window.__playerListDebug.shift();
      }
    }

    players.forEach((player) => {
      const div = document.createElement("div");
      div.className = "player-item";

      const isSelf = player.id === this.selfPlayerId;
      if (isSelf) {
        div.classList.add("self");
      }
      if (player.is_bot) {
        div.classList.add("bot");
      }

      const shortId = this.shortId(player.id);
      const name = isSelf ? `${shortId} (you)` : player.name || shortId;
      const kills = player.kills || 0;
      const health = player.health || 100;
      const team = this.formatTeam(player.team);
      const teamPrefix = team
        ? `<span data-team="${this.escapeHtml(team.id)}" style="color:${team.color}; font-weight:700;">[${team.label}]</span> `
        : "";

      div.innerHTML = `
        <span class="name" data-player-id="' + player.id + '">${teamPrefix}${this.escapeHtml(name)}${player.is_bot ? " BOT" : ""}</span>
        <span class="kills">${kills}K</span>
        <span class="health">${health}HP</span>
      `;

      this.elements.playersContainer.appendChild(div);
    });

    if (this.elements.playerCount) {
      this.elements.playerCount.textContent = `玩家: ${players.length}/10`;
    }

    this.syncSelfTeamHud();
  }

  updateHealth(health, maxHealth = 100) {
    const currentHealth = Math.max(0, Number(health) || 0);
    const percentage = Math.max(
      0,
      Math.min(100, (currentHealth / Math.max(1, maxHealth)) * 100),
    );

    if (this.elements.healthFill) {
      this.elements.healthFill.style.width = `${percentage}%`;
      this.elements.healthFill.style.background =
        percentage < 30
          ? "linear-gradient(90deg, #ff304f, #ff935c)"
          : "linear-gradient(90deg, #ff5a6f, #ff935c)";
    }

    if (this.elements.healthBar) {
      this.elements.healthBar.classList.toggle("critical", percentage < 35);
    }

    if (this.elements.healthText) {
      this.elements.healthText.textContent = `${Math.round(currentHealth)} HP`;
    }

    if (percentage < 30) {
      this.showLowHealthWarning();
    } else {
      this.hideLowHealthWarning();
    }
  }

  updateArmor(armor, hasHelmet = false) {
    if (
      !this.elements.armorBar ||
      !this.elements.armorFill ||
      !this.elements.armorText
    ) {
      return;
    }

    const currentArmor = Math.max(0, Number(armor) || 0);
    if (currentArmor <= 0) {
      this.elements.armorBar.style.display = "none";
      this.elements.armorBar.classList.remove("critical");
      if (this.elements.armorStateText) {
        this.elements.armorStateText.textContent = "NO ARMOR";
      }
      return;
    }

    this.elements.armorBar.style.display = "block";
    this.elements.armorFill.style.width = `${Math.min(100, currentArmor)}%`;
    this.elements.armorBar.classList.toggle("critical", currentArmor < 25);

    this.elements.armorText.textContent = `${hasHelmet ? "ARM+H" : "ARM"} ${Math.round(currentArmor)}`;
    if (this.elements.armorStateText) {
      this.elements.armorStateText.textContent = hasHelmet
        ? "KEVLAR+HELM"
        : "KEVLAR";
    }
  }

  updateAmmo(ammo, reserve) {
    if (this.elements.ammo) {
      this.elements.ammo.textContent = String(ammo ?? 0);
    }
    if (this.elements.ammoReserve) {
      this.elements.ammoReserve.textContent = String(reserve ?? 0);
    }

    const ammoValue = Math.max(0, Number(ammo) || 0);
    if (this.elements.ammoDisplay) {
      this.elements.ammoDisplay.classList.toggle("low-ammo", ammoValue <= 6);
    }
  }

  updateMoney(money) {
    const value = Math.max(0, Math.floor(Number(money) || 0));
    if (this.elements.money) {
      this.elements.money.textContent = `$${value}`;
    }

    if (this.lastMoneyValue !== null && value !== this.lastMoneyValue) {
      this.animateMoneyDelta(value - this.lastMoneyValue);
    }

    this.lastMoneyValue = value;
  }

  updateRoundState(state) {
    if (!state) return;

    if (this.elements.roundNumber) {
      this.elements.roundNumber.textContent = state.is_overtime
        ? `ROUND ${state.round_number}/OT`
        : `ROUND ${state.round_number}/${state.regulation_rounds || 30}`;
    }

    const teams = Array.isArray(state.teams) ? state.teams : [];
    const ct = this.findTeamEntry(teams, "ct");
    const t = this.findTeamEntry(teams, "t");

    if (this.elements.roundScore) {
      if (this.elements.ctScore && this.elements.tScore) {
        this.elements.ctScore.textContent = String(ct.score || 0);
        this.elements.tScore.textContent = String(t.score || 0);
      } else {
        this.elements.roundScore.textContent = `CT ${ct.score || 0} - ${t.score || 0} T`;
      }
    }

    const timerSeconds = Math.max(0, Number(state.timer_seconds) || 0);
    if (this.elements.roundTimer) {
      this.elements.roundTimer.textContent = this.formatClock(timerSeconds);
      const inBuyWindow = state.phase === "live" && (state.buy_time_left || 0) > 0;
      const critical = state.phase === "live" && !inBuyWindow && timerSeconds <= 10;
      this.elements.roundTimer.classList.toggle("buy-phase", inBuyWindow);
      this.elements.roundTimer.classList.toggle("is-critical", critical);
    }

    if (this.elements.roundPhase) {
      this.elements.roundPhase.textContent = this.formatRoundPhase(state);
    }

    if (this.elements.roundPanel) {
      this.elements.roundPanel.dataset.phase = state.phase || "waiting";
    }

    this.syncSelfTeamHud();
  }

  resetRoundState() {
    this.updateRoundState({
      phase: "waiting",
      round_number: 1,
      regulation_rounds: 30,
      timer_seconds: 0,
      teams: [],
      is_overtime: false,
      buy_time_left: 0,
    });
  }

  updateWeapon(weaponNameOrId) {
    const weaponConfig = this.resolveWeaponConfig(weaponNameOrId);
    const weaponLabel =
      weaponConfig?.name ||
      (weaponNameOrId ? String(weaponNameOrId).toUpperCase() : "RIFLE");

    if (this.elements.currentWeapon) {
      this.elements.currentWeapon.textContent = weaponLabel;
    }

    if (this.elements.weaponIcon) {
      this.elements.weaponIcon.innerHTML = this.renderWeaponIconMarkup(
        weaponConfig?.id || weaponNameOrId,
      );
    }
  }

  updateScore(score) {
    console.log("Score:", score);
  }

  updateKD(kills, deaths) {
    console.log("K/D:", kills, "/", deaths);
  }

  updateKills(kills) {
    console.log("Kills:", kills);
  }

  updateDeaths(deaths) {
    console.log("Deaths:", deaths);
  }

  updateRoom(roomId, playerCount) {
    if (this.elements.roomId) {
      this.elements.roomId.textContent = roomId || "-";
    }
    if (this.elements.playerCount) {
      this.elements.playerCount.textContent = `玩家: ${playerCount}`;
    }
  }

  updateConnectionStatus(connected) {
    if (!this.elements.connectionStatus) return;

    this.elements.connectionStatus.textContent = connected ? "已连接" : "已断开";
    this.elements.connectionStatus.className = connected
      ? "connected"
      : "disconnected";
  }

  addChatMessage(name, message) {
    if (!this.elements.chatMessages) return;

    const div = document.createElement("div");
    div.className = "chat-message";
    div.innerHTML = `<span class="name" data-player-id="' + player.id + '">${this.escapeHtml(name)}:</span> ${this.escapeHtml(message)}`;
    this.elements.chatMessages.appendChild(div);
    this.elements.chatMessages.scrollTop =
      this.elements.chatMessages.scrollHeight;

    while (this.elements.chatMessages.children.length > 50) {
      this.elements.chatMessages.removeChild(
        this.elements.chatMessages.firstChild,
      );
    }
  }

  addKillFeed(entry) {
    if (!this.elements.killFeed) return;

    const normalized = this.normalizeKillFeedEntry(entry);
    const div = document.createElement("div");
    div.className = `kill-item ${normalized.type || "generic"}${normalized.system ? " system" : ""}`;
    div.innerHTML = normalized.system
      ? `
        <div class="kill-item-main">
          <span class="kill-actor">${this.escapeHtml(normalized.left)}</span>
          <span class="kill-headshot">${this.escapeHtml(normalized.icon)}</span>
          <span class="kill-actor">${this.escapeHtml(normalized.right)}</span>
        </div>
        <div class="kill-feed-meta">${this.escapeHtml(normalized.meta)}</div>
      `
      : `
        <div class="kill-item-main">
          <span class="kill-actor ${this.escapeHtml(normalized.leftClass)}">${this.escapeHtml(normalized.left)}</span>
          <span class="kill-weapon">${this.renderWeaponIconMarkup(normalized.weapon)}</span>
          ${normalized.headshot ? '<span class="kill-headshot">HS</span>' : ""}
          <span class="kill-actor ${this.escapeHtml(normalized.rightClass)}">${this.escapeHtml(normalized.right)}</span>
        </div>
        <div class="kill-feed-meta">${this.escapeHtml(normalized.meta)}</div>
      `;

    this.elements.killFeed.prepend(div);

    window.setTimeout(() => {
      if (div.parentNode === this.elements.killFeed) {
        this.elements.killFeed.removeChild(div);
      }
    }, 5000);

    while (this.elements.killFeed.children.length > 6) {
      this.elements.killFeed.removeChild(this.elements.killFeed.lastChild);
    }
  }

  toggleScoreboard(show) {
    if (!this.elements.scoreboard) return;

    const visible = Boolean(show);
    this.elements.scoreboard.classList.toggle("show", visible);
    this.elements.scoreboard.classList.toggle("visible", visible);
    this.elements.scoreboard.setAttribute("aria-hidden", String(!visible));
  }

  updateScoreboard(players, teams = null) {
    if (!this.elements.scoreboardBody) return;

    const sortedPlayers = [...players].sort((a, b) =>
      this.comparePlayersForScoreboard(a, b),
    );
    const scoreboardTeams = this.normalizeScoreboardTeams(
      teams,
      sortedPlayers,
    );

    this.elements.scoreboardBody.innerHTML = "";
    this.updateScoreboardTeamSummary(scoreboardTeams);
    this.updateScoreboardMvp(sortedPlayers[0]);

    const useTableRows = this.elements.scoreboardBody.tagName === "TBODY";
    sortedPlayers.forEach((player, index) => {
      const assists = player.assists || player.assist || 0;
      const kills = player.kills || 0;
      const deaths = player.deaths || 0;
      const score = player.score || 0;
      const money = Math.max(0, Math.floor(Number(player.money) || 0));
      const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
      const team = this.formatTeam(player.team);
      const teamLabel = team?.label || "FFA";
      const teamColor = team?.color || "#9aa8ba";
      const name = player.name || player.id || "Unknown";
      const isSelf = player.id === this.selfPlayerId;
      const isMvp = index === 0;

      if (useTableRows) {
        const row = document.createElement("tr");
        row.className = `score-row player-row${isMvp ? " mvp" : ""}${isSelf ? " self" : ""}`;
        row.innerHTML = `
          <td>
            <div class="player-main">
              <span class="player-name">${this.escapeHtml(name)}</span>
              <span class="player-caption">${isSelf ? "YOU" : `#${index + 1}`}</span>
            </div>
          </td>
          <td><span class="team-pill" style="color:${teamColor};">${this.escapeHtml(teamLabel)}</span></td>
          <td class="stat-cell">${kills}</td>
          <td class="stat-cell">${deaths}</td>
          <td class="stat-cell">${assists}</td>
          <td class="stat-cell">${kdRatio}</td>
          <td class="stat-cell money-cell">$${money}</td>
          <td class="stat-cell">${score}</td>
        `;
        this.elements.scoreboardBody.appendChild(row);
        return;
      }

      const row = document.createElement("div");
      row.className = `score-row player-row${isMvp ? " mvp" : ""}${isSelf ? " self" : ""}`;
      row.innerHTML = `
        <div class="player-main">
          <span class="player-name">${this.escapeHtml(name)}</span>
          <span class="player-caption">${isSelf ? "YOU" : `#${index + 1}`}</span>
        </div>
        <div><span class="team-pill" style="color:${teamColor};">${this.escapeHtml(teamLabel)}</span></div>
        <div class="stat-cell">${kills}</div>
        <div class="stat-cell">${deaths}</div>
        <div class="stat-cell">${assists}</div>
        <div class="stat-cell">${kdRatio}</div>
        <div class="stat-cell money-cell">$${money}</div>
        <div class="stat-cell">${score}</div>
      `;
      this.elements.scoreboardBody.appendChild(row);
    });
  }

  updateScoreboardTeamSummary(teams) {
    if (!this.elements.scoreboardTeamSummary) return;

    const normalizedTeams = this.normalizeScoreboardTeams(teams);
    if (!normalizedTeams.length) {
      this.elements.scoreboardTeamSummary.innerHTML = "";
      return;
    }

    this.elements.scoreboardTeamSummary.innerHTML = normalizedTeams
      .map((team) => {
        const color = team.color || "#9aa8ba";
        return `
          <div class="team-score-card" style="border-color:${this.withAlpha(color, "33")};">
            <span class="team-name" style="color:${color};">${this.escapeHtml(team.short_name || team.label || String(team.id || "TEAM").toUpperCase())}</span>
            <span class="team-score" style="color:${color};">${team.score || 0}</span>
          </div>
        `;
      })
      .join("");
  }

  updateScoreboardMvp(player) {
    if (!this.elements.scoreboardMvp) return;

    if (!player) {
      this.elements.scoreboardMvp.classList.remove("show");
      this.elements.scoreboardMvp.innerHTML = "";
      return;
    }

    const team = this.formatTeam(player.team);
    const assists = player.assists || player.assist || 0;
    const kills = player.kills || 0;
    const deaths = player.deaths || 0;
    const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
    const name = player.name || player.id || "Unknown";
    const teamLabel = team?.label || "FFA";
    const teamColor = team?.color || "#9aa8ba";

    this.elements.scoreboardMvp.innerHTML = `
      <div>
        <span class="mvp-badge">Current MVP</span>
        <span class="mvp-name">${this.escapeHtml(name)}</span>
      </div>
      <div class="mvp-meta">
        <span class="mvp-pill" style="color:${teamColor};">${this.escapeHtml(teamLabel)}</span>
        <span class="mvp-pill">${kills}/${deaths}/${assists} KDA</span>
        <span class="mvp-pill">${kdRatio} K/D</span>
        <span class="mvp-pill">${player.score || 0} PTS</span>
      </div>
    `;
    this.elements.scoreboardMvp.classList.add("show");
  }

  showDamageIndicator(sourceOrAngle, damage = 0) {
    if (!this.elements.damageDirectionIndicator) return;

    const angle = this.resolveDamageAngle(sourceOrAngle);
    const arrow = document.createElement("div");
    arrow.className = "damage-direction-arrow";
    arrow.style.setProperty("--damage-rotation", `${angle}deg`);
    arrow.style.setProperty(
      "--impact-strength",
      String(Math.max(0.2, Math.min(1, (Number(damage) || 0) / 60))),
    );

    this.elements.damageDirectionIndicator.appendChild(arrow);
    window.setTimeout(() => {
      arrow.remove();
    }, 720);
  }

  showHitMarker(options = {}) {
    const screenEffects = this.getScreenEffects();
    if (screenEffects?.showHitMarker) {
      screenEffects.showHitMarker(options);
      return;
    }

    if (!this.elements.hitMarker) return;

    const headshot =
      options === "head" ||
      options?.headshot === true ||
      options?.isHeadshot === true ||
      options?.hitbox === "head";
    const damage = Number(options?.damage) || 0;
    const label = headshot ? "HEADSHOT" : damage > 0 ? `+${Math.round(damage)}` : "HIT";

    if (this.elements.hitMarkerLabel) {
      this.elements.hitMarkerLabel.textContent = label;
    }

    this.elements.hitMarker.classList.remove("active", "headshot");
    void this.elements.hitMarker.offsetWidth;
    this.elements.hitMarker.classList.add("active");
    this.elements.hitMarker.classList.toggle("headshot", headshot);

    window.clearTimeout(this.hitMarkerTimer);
    this.hitMarkerTimer = window.setTimeout(() => {
      this.elements.hitMarker?.classList.remove("active", "headshot");
    }, 180);
  }

  showKillConfirmation(victimName, options = {}) {
    if (!this.elements.killConfirmation || !victimName) return;

    const headline = options.isSuicide
      ? "SELF ELIMINATION"
      : options.isHeadshot
        ? "HEADSHOT CONFIRMED"
        : "ELIMINATION CONFIRMED";
    const title = options.isSuicide
      ? this.escapeHtml(victimName)
      : this.escapeHtml(victimName);

    const metaParts = [];
    if (options.weapon) {
      metaParts.push(
        `${this.getWeaponIcon(options.weapon)} ${String(options.weapon).toUpperCase()}`,
      );
    }
    if (options.isHeadshot) {
      metaParts.push("HEADSHOT");
    }
    if (!metaParts.length) {
      metaParts.push("CLEAN FINISH");
    }

    this.elements.killConfirmation.innerHTML = `
      <span class="eyebrow">${this.escapeHtml(headline)}</span>
      <span class="title">${title}</span>
      <span class="meta">${this.escapeHtml(metaParts.join(" | "))}</span>
    `;
    this.elements.killConfirmation.classList.add("show");

    window.clearTimeout(this.killConfirmationTimer);
    this.killConfirmationTimer = window.setTimeout(() => {
      this.elements.killConfirmation?.classList.remove("show");
    }, 1800);
  }

  updateCrosshairSpread(spread) {
    const value = Math.max(0, Number(spread) || 0);
    document.documentElement.style.setProperty("--crosshair-spread", `${value}`);
    if (window.dynamicCrosshair?.__uiStyled) {
      window.dynamicCrosshair.currentSpread = value;
      window.dynamicCrosshair.render?.();
    }
  }

  showDeathScreen() {
    let overlay = document.getElementById("death-screen");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "death-screen";
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        font-size: 32px;
        font-weight: 800;
        letter-spacing: 0.12em;
        z-index: 320;
      `;
      overlay.textContent = "ELIMINATED";
      document.body.appendChild(overlay);
    }
    overlay.style.display = "flex";
  }

  hideDeathScreen() {
    const overlay = document.getElementById("death-screen");
    if (overlay) {
      overlay.style.display = "none";
    }
  }

  showLowHealthWarning() {
    this.getScreenEffects()?.setLowHealthActive?.(true);
  }

  hideLowHealthWarning() {
    this.getScreenEffects()?.setLowHealthActive?.(false);
  }

  showMessage(text, typeOrDuration = 3000, durationOverride = null) {
    const duration =
      typeof typeOrDuration === "number"
        ? typeOrDuration
        : durationOverride || 3000;
    const type = typeof typeOrDuration === "string" ? typeOrDuration : "info";
    const message = document.createElement("div");
    message.className = "game-message";
    message.style.cssText = `
      position: fixed;
      top: 30%;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === "error" ? "rgba(180, 32, 32, 0.92)" : type === "success" ? "rgba(30, 120, 60, 0.92)" : "rgba(0, 0, 0, 0.8)"};
      color: #fff;
      padding: 15px 30px;
      border-radius: 10px;
      font-size: 1.2rem;
      z-index: 50;
      animation: fadeInOut ${duration}ms ease-in-out;
    `;
    message.textContent = text;
    document.body.appendChild(message);

    window.setTimeout(() => {
      message.remove();
    }, duration);
  }

  startRuntimeSync() {
    if (this.runtimeSyncInterval) return;

    this.syncRuntimeHud();
    this.runtimeSyncInterval = window.setInterval(() => {
      this.syncRuntimeHud();
    }, 200);
  }

  syncRuntimeHud() {
    const selfTeam = this.resolveSelfTeam();
    if (selfTeam !== this.lastSyncedTeam) {
      this.syncSelfTeamHud(selfTeam);
      this.lastSyncedTeam = selfTeam;
    }

    this.enhanceDynamicCrosshair();

    const playerWeapon = window.game?.player?.weapon;
    if (playerWeapon && playerWeapon !== this.lastSyncedWeapon) {
      this.updateWeapon(playerWeapon);
      this.lastSyncedWeapon = playerWeapon;
    }
  }

  bindCrosshairColorPicker() {
    const options = this.elements.crosshairColorOptions || [];
    options.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.applyCrosshairColor(button.dataset.color || "green");
      });
    });

    this.applyCrosshairColor(this.crosshairColorKey, false);
  }

  loadStoredCrosshairColor() {
    try {
      const stored = window.localStorage?.getItem("fps-crosshair-color");
      return this.normalizeCrosshairColor(stored);
    } catch (_error) {
      return "green";
    }
  }

  normalizeCrosshairColor(color) {
    return ["green", "cyan", "yellow"].includes(color) ? color : "green";
  }

  applyCrosshairColor(color, persist = true) {
    const normalized = this.normalizeCrosshairColor(color);
    this.crosshairColorKey = normalized;

    if (this.elements.crosshair) {
      this.elements.crosshair.dataset.color = normalized;
    }

    (this.elements.crosshairColorOptions || []).forEach((button) => {
      button.classList.toggle("is-active", button.dataset.color === normalized);
    });

    if (persist) {
      try {
        window.localStorage?.setItem("fps-crosshair-color", normalized);
      } catch (_error) {
        // ignore storage failures
      }
    }

    if (window.dynamicCrosshair?.__uiStyled) {
      window.dynamicCrosshair.color = normalized;
      window.dynamicCrosshair.render?.();
    }
  }

  syncSelfTeamHud(teamId = null) {
    const resolvedTeamId = this.resolveSelfTeam(teamId);
    const team = this.formatTeam(resolvedTeamId);
    const label = team?.label || "SPEC";

    [this.elements.selfTeamIndicator, this.elements.minimapTeamLabel].forEach(
      (element) => {
        if (!element) return;
        element.dataset.team = team?.id || "spectator";
        element.textContent = label;
      },
    );

    document.body.dataset.team = team?.id || "spectator";
  }

  resolveSelfTeam(teamId = null) {
    const candidate =
      teamId ||
      window.game?.player?.team ||
      window.teamSystem?.getPlayerTeam?.(this.selfPlayerId)?.id ||
      "";
    return String(candidate || "").toLowerCase();
  }

  enhanceDynamicCrosshair() {
    const crosshair = window.dynamicCrosshair;
    const element = this.elements.crosshair;
    if (!crosshair || !element) {
      return false;
    }

    if (crosshair.__uiStyled) {
      crosshair.render?.();
      return true;
    }

    crosshair.__uiStyled = true;
    crosshair.element = element;
    crosshair.baseSpread = 12;
    crosshair.moveSpread = 8;
    crosshair.shootSpread = 12;
    crosshair.currentSpread = crosshair.baseSpread;

    crosshair.render = () => {
      const spread = Math.max(10, Number(crosshair.currentSpread) || 12);
      const gap = `${Math.round(spread * 0.72)}px`;
      const length = `${crosshair.isShooting ? 15 : 13}px`;
      const thickness = `${crosshair.isShooting ? 3 : 2}px`;

      element.dataset.color = this.crosshairColorKey;
      element.style.setProperty("--crosshair-gap", gap);
      element.style.setProperty("--crosshair-length", length);
      element.style.setProperty("--crosshair-thickness", thickness);
      element.classList.toggle("is-moving", Boolean(crosshair.isMoving));
      element.classList.toggle("is-shooting", Boolean(crosshair.isShooting));
    };

    crosshair.setMoving = (moving) => {
      crosshair.isMoving = Boolean(moving);
      crosshair.render();
    };

    crosshair.setShooting = (shooting) => {
      const changed = Boolean(shooting) && !crosshair.isShooting;
      crosshair.isShooting = Boolean(shooting);
      crosshair.render();
      if (changed) {
        this.getScreenEffects()?.showMuzzleFlash?.();
      }
    };

    crosshair.showHit = () => {
      this.showHitMarker();
      element.classList.remove("hit");
      void element.offsetWidth;
      element.classList.add("hit");
      window.clearTimeout(this.crosshairHitTimer);
      this.crosshairHitTimer = window.setTimeout(() => {
        element.classList.remove("hit");
      }, 140);
    };

    this.applyCrosshairColor(this.crosshairColorKey, false);
    crosshair.render();
    return true;
  }

  getScreenEffects() {
    return window.screenEffects || window.screenEffectsEnhanced || null;
  }

  startBridgePolling() {
    if (this.bridgeInterval) return;

    this.bridgeInterval = window.setInterval(() => {
      const remaining = this.installExternalFeedbackBridges();
      this.bridgeAttempts += 1;
      if (remaining === 0 || this.bridgeAttempts >= 20) {
        window.clearInterval(this.bridgeInterval);
        this.bridgeInterval = null;
      }
    }, 400);
  }

  installExternalFeedbackBridges() {
    const crosshairReady = this.enhanceDynamicCrosshair();
    const targets = [
      [
        "hitEffects",
        "showHitMarker",
        (_position, hitbox, damage) => this.showHitMarker({ hitbox, damage }),
      ],
      [
        "hitIndicator",
        "show",
        (enemyPosition, damage) => this.showDamageIndicator(enemyPosition, damage),
      ],
      [
        "killNotice",
        "show",
        (victimName, options) => this.showKillConfirmation(victimName, options),
      ],
    ];

    let missing = crosshairReady ? 0 : 1;
    targets.forEach(([globalName, methodName, hook]) => {
      if (!this.wrapGlobalMethod(globalName, methodName, hook)) {
        missing += 1;
      }
    });

    return missing;
  }

  wrapGlobalMethod(globalName, methodName, beforeHook) {
    const target = window?.[globalName];
    if (!target || typeof target[methodName] !== "function") {
      return false;
    }

    const currentMethod = target[methodName];
    if (currentMethod.__uiWrapped) {
      return true;
    }

    const original = currentMethod.bind(target);
    const wrapped = (...args) => {
      try {
        beforeHook(...args);
      } catch (error) {
        console.warn(`[UI] ${globalName}.${methodName} bridge failed`, error);
      }
      return original(...args);
    };

    wrapped.__uiWrapped = true;
    target[methodName] = wrapped;
    return true;
  }

  normalizeKillFeedEntry(entry) {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const killer = this.resolvePlayerDisplayName(entry.killer || entry.actor || "YOU");
      const victim = this.resolvePlayerDisplayName(entry.victim || entry.target || "TARGET");
      const headshot = entry.isHeadshot || entry.headshot;
      const weapon = entry.weapon || entry.weaponId || "rifle";
      return {
        type: headshot ? "headshot" : "kill",
        left: killer,
        right: victim,
        leftClass: this.resolveTeamClass(entry.killerTeam || entry.killer_id || entry.killer),
        rightClass: this.resolveTeamClass(entry.victimTeam || entry.victim_id || entry.victim),
        weapon,
        headshot: Boolean(headshot),
        meta: weapon ? `WEAPON ${this.getWeaponIcon(weapon)}` : "ELIMINATION",
        system: false,
      };
    }

    const text = String(entry ?? "").trim();
    let match = text.match(/^(.+)\s+加入了游戏$/);
    if (match) {
      return {
        type: "join",
        left: match[1],
        right: "GAME",
        icon: "+",
        meta: "Player joined",
        system: true,
      };
    }

    match = text.match(/^(.+)\s+离开了游戏$/);
    if (match) {
      return {
        type: "leave",
        left: match[1],
        right: "EXIT",
        icon: "-",
        meta: "Player left",
        system: true,
      };
    }

    match = text.match(/^你击中了\s+(.+)!$/);
    if (match) {
      return {
        type: "hit",
        left: "YOU",
        right: match[1],
        icon: "DMG",
        meta: "Confirmed hit",
        system: true,
      };
    }

    match = text.match(/^你被\s+(.+)\s+击杀了$/);
    if (match) {
      return {
        type: "death",
        left: match[1],
        right: "YOU",
        icon: "X",
        meta: "Eliminated",
        system: true,
      };
    }

    match = text.match(/^击杀\s+(.+?)(?:\s+\((爆头!)\))?$/);
    if (match) {
      return {
        type: match[2] ? "headshot" : "kill",
        left: "YOU",
        right: match[1],
        leftClass: this.resolveTeamClass(this.selfPlayerId),
        rightClass: this.resolveTeamClass(match[1]),
        weapon: "rifle",
        headshot: Boolean(match[2]),
        meta: match[2] ? "HEADSHOT CONFIRMED" : "ELIMINATION",
        system: false,
      };
    }

    return {
      type: "generic",
      left: text || "EVENT",
      right: "INFO",
      icon: "*",
      meta: "System",
      system: true,
    };
  }

  normalizeScoreboardTeams(teams, players = []) {
    if (Array.isArray(teams) && teams.length > 0) {
      return teams
        .map((team) => {
          const teamId =
            team.id || team.team_id || team.name || team.label || team.short_name;
          const formatted = this.formatTeam(teamId);
          return {
            ...team,
            id: teamId,
            label:
              team.label ||
              team.short_name ||
              formatted?.label ||
              String(teamId || "team").toUpperCase(),
            short_name:
              team.short_name ||
              formatted?.label ||
              String(teamId || "team").toUpperCase(),
            color: formatted?.color || team.color || "#9aa8ba",
            score: Number(team.score) || 0,
          };
        })
        .sort((a, b) => this.teamOrder(a.id) - this.teamOrder(b.id));
    }

    const aggregate = new Map();
    players.forEach((player) => {
      const key = String(player.team || "").toLowerCase();
      if (!key) return;
      const formatted = this.formatTeam(key);
      const current = aggregate.get(key) || {
        id: key,
        label: formatted?.label || key.toUpperCase(),
        short_name: formatted?.label || key.toUpperCase(),
        color: formatted?.color || "#9aa8ba",
        score: 0,
      };
      current.score += Number(player.score) || 0;
      aggregate.set(key, current);
    });

    return [...aggregate.values()].sort(
      (a, b) => this.teamOrder(a.id) - this.teamOrder(b.id),
    );
  }

  comparePlayersForScoreboard(a, b) {
    return (
      (b.score || 0) - (a.score || 0) ||
      (b.kills || 0) - (a.kills || 0) ||
      (a.deaths || 0) - (b.deaths || 0) ||
      String(a.name || a.id || "").localeCompare(String(b.name || b.id || ""))
    );
  }

  resolveDamageAngle(sourceOrAngle) {
    if (typeof sourceOrAngle === "number" && Number.isFinite(sourceOrAngle)) {
      return sourceOrAngle;
    }

    if (
      sourceOrAngle &&
      typeof sourceOrAngle.angle === "number" &&
      Number.isFinite(sourceOrAngle.angle)
    ) {
      return sourceOrAngle.angle;
    }

    if (
      sourceOrAngle &&
      typeof sourceOrAngle.x === "number" &&
      typeof sourceOrAngle.z === "number"
    ) {
      const playerPos = window.game?.player?.position;
      const playerRotation = window.game?.player?.rotation || 0;
      if (!playerPos) return 0;

      const dx = sourceOrAngle.x - playerPos.x;
      const dz = sourceOrAngle.z - playerPos.z;
      const worldAngle = Math.atan2(dx, dz);
      return this.normalizeDegrees((worldAngle - playerRotation) * (180 / Math.PI));
    }

    return 0;
  }

  animateMoneyDelta(delta) {
    if (!delta || !this.elements.money) return;

    const directionClass = delta > 0 ? "money-up" : "money-down";
    this.elements.money.classList.remove("money-up", "money-down");
    void this.elements.money.offsetWidth;
    this.elements.money.classList.add(directionClass);

    window.clearTimeout(this.moneyAnimationTimer);
    this.moneyAnimationTimer = window.setTimeout(() => {
      this.elements.money?.classList.remove("money-up", "money-down");
    }, 360);

    if (!this.elements.moneyChange) return;

    this.elements.moneyChange.textContent = `${delta > 0 ? "+" : "-"}$${Math.abs(delta)}`;
    this.elements.moneyChange.className = "";
    void this.elements.moneyChange.offsetWidth;
    this.elements.moneyChange.classList.add(
      "show",
      delta > 0 ? "positive" : "negative",
    );

    window.clearTimeout(this.moneyDeltaTimer);
    this.moneyDeltaTimer = window.setTimeout(() => {
      this.elements.moneyChange?.classList.remove(
        "show",
        "positive",
        "negative",
      );
    }, 1000);
  }

  findTeamEntry(teams, teamId) {
    return (
      teams.find(
        (entry) =>
          String(entry.id || entry.team_id || "").toLowerCase() === teamId,
      ) || { score: 0 }
    );
  }

  teamOrder(teamId) {
    const normalized = String(teamId || "").toLowerCase();
    if (normalized === "ct" || normalized === "blue") return 0;
    if (normalized === "t" || normalized === "red") return 1;
    return 2;
  }

  resolvePlayerDisplayName(playerRef) {
    if (!playerRef) return "UNKNOWN";
    if (playerRef === "YOU") return "YOU";

    const value = String(playerRef);
    if (value === this.selfPlayerId) {
      return "YOU";
    }

    const remotePlayer = window.game?.players?.get?.(value);
    if (remotePlayer?.name) {
      return remotePlayer.name;
    }

    return value;
  }

  resolveTeamClass(playerOrTeamRef) {
    const team = this.formatTeam(playerOrTeamRef);
    if (team) {
      return team.id === "ct" ? "team-ct" : team.id === "t" ? "team-t" : "";
    }

    const playerId = String(playerOrTeamRef || "");
    if (playerId && playerId === this.selfPlayerId) {
      const selfTeam = this.formatTeam(window.game?.player?.team);
      return selfTeam?.id === "ct"
        ? "team-ct"
        : selfTeam?.id === "t"
          ? "team-t"
          : "";
    }

    const remoteTeam = this.formatTeam(window.game?.players?.get?.(playerId)?.team);
    return remoteTeam?.id === "ct"
      ? "team-ct"
      : remoteTeam?.id === "t"
        ? "team-t"
        : "";
  }

  resolveWeaponConfig(weaponNameOrId) {
    const rawValue = String(weaponNameOrId || "").trim();
    if (!rawValue) return null;

    const directKey = rawValue.toLowerCase();
    const directConfig = window.weaponSystem?.getWeapon?.(directKey);
    if (directConfig) {
      return directConfig;
    }

    const weapons = Object.values(window.weaponSystem?.weapons || {});
    return (
      weapons.find(
        (weapon) =>
          String(weapon.name || "").toLowerCase() === directKey ||
          String(weapon.id || "").toLowerCase() === directKey,
      ) || null
    );
  }

  renderWeaponIconMarkup(weaponNameOrId) {
    const config = this.resolveWeaponConfig(weaponNameOrId);
    const key = String(config?.id || weaponNameOrId || "").toLowerCase();
    const type = config?.type || this.inferWeaponType(key);
    const path = this.getWeaponPath(type);

    return `
      <svg viewBox="0 0 120 48" aria-hidden="true" focusable="false">
        <path d="${path}"></path>
      </svg>
    `;
  }

  inferWeaponType(key) {
    if (
      key.includes("usp") ||
      key.includes("glock") ||
      key.includes("deagle") ||
      key.includes("pistol")
    ) {
      return "pistol";
    }
    if (key.includes("awp") || key.includes("sniper")) {
      return "sniper";
    }
    if (key.includes("shotgun") || key.includes("spas")) {
      return "shotgun";
    }
    if (key.includes("mp5") || key.includes("p90") || key.includes("smg")) {
      return "smg";
    }
    return "rifle";
  }

  getWeaponPath(type) {
    switch (type) {
      case "pistol":
        return "M12 24h18l8-8h20v8h10v8H40l-8 8H18l-6-4H8V24z";
      case "sniper":
        return "M6 20h56l12-6h22v4h14v6H98l-12 8H64l-10 10H34l-6 4H20v-6H6zM38 10h18v6H38z";
      case "shotgun":
        return "M6 21h54l18-8h28v10H84l-14 12H42l-12 6H18v-6H6z";
      case "smg":
        return "M8 21h34l10-8h20v8h12v10H62l-6 8H40l-8-6H22v8H12v-10H8z";
      default:
        return "M6 21h38l16-10h30l12 4v10H86l-18 14H42l-8 6H22v-6H6z";
    }
  }

  getWeaponIcon(weapon) {
    const key = String(weapon || "").toLowerCase();
    if (key.includes("knife")) return "KNF";
    if (key.includes("awp") || key.includes("sniper")) return "AWP";
    if (key.includes("pistol") || key.includes("deagle")) return "PST";
    if (key.includes("grenade")) return "GRN";
    if (key.includes("smg")) return "SMG";
    return "RFL";
  }

  shortId(id) {
    return String(id || "").slice(0, 8);
  }

  parseCurrency(text) {
    const numeric = Number(String(text || "").replace(/[^\d-]/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
  }

  normalizeDegrees(degrees) {
    const normalized = degrees % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  withAlpha(color, alphaHex = "33") {
    if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) {
      return `${color}${alphaHex}`;
    }
    return color;
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  formatTeam(teamId) {
    const normalized = String(teamId || "").toLowerCase();
    if (normalized === "ct" || normalized === "blue") {
      return { id: "ct", label: "CT", color: "#8dff72" };
    }
    if (normalized === "t" || normalized === "red") {
      return { id: "t", label: "T", color: "#ffad52" };
    }
    return null;
  }

  formatClock(totalSeconds) {
    const seconds = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  formatRoundPhase(state) {
    switch (state.phase) {
      case "freeze":
        return "FREEZETIME";
      case "live":
        if ((state.buy_time_left || 0) > 0) {
          return `BUY ${state.buy_time_left}s`;
        }
        return "LIVE";
      case "ended":
        return "ROUND END";
      case "match_over":
        return "MATCH OVER";
      default:
        return "WARMUP";
    }
  }

  // C4 Progress UI
  showC4Progress(type, hasKit = false) {
    let container = document.getElementById('c4-progress-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'c4-progress-container';
      container.style.cssText = `
        position: fixed;
        bottom: 150px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 200;
      `;
      document.body.appendChild(container);
    }

    const action = type === 'plant' ? '安装' : '拆除';
    const color = type === 'plant' ? '#f44336' : '#4CAF50';
    const kitHint = type === 'defuse' && hasKit ? '<div style="color: #4CAF50; font-size: 12px; margin-top: 5px;">🔧 拆弹器加速 (2.5s)</div>' : '';

    container.innerHTML = `
      <div style="
        background: rgba(0, 0, 0, 0.85);
        padding: 15px 30px;
        border-radius: 10px;
        border: 2px solid ${color};
        min-width: 250px;
      ">
        <div style="color: white; margin-bottom: 10px; font-size: 14px;">
          ⏳ 正在${action}C4...
        </div>
        <div style="
          width: 200px;
          height: 12px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          overflow: hidden;
          margin: 0 auto;
        ">
          <div id="c4-progress-fill" style="
            width: 0%;
            height: 100%;
            background: ${color};
            transition: width 0.05s linear;
          "></div>
        </div>
        ${kitHint}
      </div>
    `;
    container.style.display = 'block';
  }

  updateC4Progress(progress) {
    const fill = document.getElementById('c4-progress-fill');
    if (fill) {
      fill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
  }

  hideC4Progress() {
    const container = document.getElementById('c4-progress-container');
    if (container) {
      container.style.display = 'none';
    }
  }

  showC4Timer(seconds) {
    let timer = document.getElementById('c4-timer-display');
    if (!timer) {
      timer = document.createElement('div');
      timer.id = 'c4-timer-display';
      timer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 150;
        pointer-events: none;
      `;
      document.body.appendChild(timer);
    }

    this.c4TimerSeconds = seconds;
    this.updateC4TimerDisplay();

    if (!this.c4TimerInterval) {
      this.c4TimerInterval = setInterval(() => {
        if (this.c4TimerSeconds > 0) {
          this.c4TimerSeconds--;
          this.updateC4TimerDisplay();
        } else {
          this.hideC4Timer();
        }
      }, 1000);
    }
  }

  updateC4TimerDisplay() {
    const timer = document.getElementById('c4-timer-display');
    if (!timer) return;

    const isCritical = this.c4TimerSeconds <= 10;
    const color = isCritical ? '#f44336' : '#ffc107';

    timer.innerHTML = `
      <div style="
        background: rgba(0, 0, 0, 0.85);
        padding: 20px 40px;
        border-radius: 10px;
        border: 3px solid ${color};
        ${isCritical ? 'animation: c4Pulse 0.5s infinite;' : ''}
      ">
        <div style="font-size: 60px; font-weight: bold; color: ${color};">
          💣 ${this.c4TimerSeconds}s
        </div>
      </div>
    `;
    timer.style.display = 'block';
  }

  hideC4Timer() {
    const timer = document.getElementById('c4-timer-display');
    if (timer) {
      timer.style.display = 'none';
    }
    if (this.c4TimerInterval) {
      clearInterval(this.c4TimerInterval);
      this.c4TimerInterval = null;
    }
  }

  // 显示/隐藏说话状态指示器
  showSpeakingIndicator(playerId, speaking) {
    const playerItems = this.elements.playersContainer?.querySelectorAll(".player-item") || [];
    for (const item of playerItems) {
      const nameSpan = item.querySelector(".name");
      if (nameSpan && nameSpan.dataset.playerId === playerId) {
        let indicator = item.querySelector(".speaking-indicator");
        if (speaking && !indicator) {
          indicator = document.createElement("span");
          indicator.className = "speaking-indicator";
          indicator.textContent = " 🔊";
          indicator.style.marginLeft = "4px";
          item.appendChild(indicator);
        } else if (!speaking && indicator) {
          indicator.remove();
        }
        break;
      }
    }
  }

  // 更新玩家列表中的说话状态
  updateSpeakingStates(speakingPlayers) {
    const playerItems = this.elements.playersContainer?.querySelectorAll(".player-item") || [];
    playerItems.forEach((item) => {
      const nameSpan = item.querySelector(".name");
      if (!nameSpan) return;
      const playerId = nameSpan.dataset.playerId;
      let indicator = item.querySelector(".speaking-indicator");
      if (speakingPlayers.has(playerId)) {
        if (!indicator) {
          indicator = document.createElement("span");
          indicator.className = "speaking-indicator";
          indicator.textContent = " 🔊";
          indicator.style.marginLeft = "4px";
          item.appendChild(indicator);
        }
      } else if (indicator) {
        indicator.remove();
      }
    });
  }
}

// Add C4 pulse animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes c4Pulse {
      0%, 100% { transform: translate(-50%, -50%) scale(1); }
      50% { transform: translate(-50%, -50%) scale(1.05); }
    }
  `;
  document.head.appendChild(style);
}

window.UIManager = UIManager;

