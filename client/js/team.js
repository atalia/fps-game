class TeamSystem {
  constructor() {
    this.teams = new Map();
    this.playerTeam = new Map();
    this.teamWeapons = {
      ct: ["usp", "mp5", "p90", "m4a1", "famas", "awp", "deagle"],
      t: ["glock", "mp5", "p90", "ak47", "galil", "awp", "deagle"],
    };
    this.setTeams(this.getDefaultTeams());
  }

  getDefaultTeams() {
    return [
      {
        id: "ct",
        name: "Counter-Terrorists",
        short_name: "CT",
        color: "#2196F3",
        model: "ct",
        score: 0,
        player_count: 0,
        max_players: 5,
      },
      {
        id: "t",
        name: "Terrorists",
        short_name: "T",
        color: "#f44336",
        model: "t",
        score: 0,
        player_count: 0,
        max_players: 5,
      },
    ];
  }

  normalizeTeamId(teamId) {
    const normalized = String(teamId || "")
      .trim()
      .toLowerCase();
    if (
      normalized === "blue" ||
      normalized === "ct" ||
      normalized === "counter-terrorists"
    ) {
      return "ct";
    }
    if (
      normalized === "red" ||
      normalized === "t" ||
      normalized === "terrorists"
    ) {
      return "t";
    }
    return normalized;
  }

  normalizeWeaponId(teamId, weaponId) {
    const normalizedTeam = this.normalizeTeamId(teamId);
    const normalizedWeapon = String(weaponId || "")
      .trim()
      .toLowerCase();

    if (normalizedWeapon === "desert_eagle") return "deagle";
    if (normalizedWeapon === "sniper") return normalizedTeam ? "awp" : "sniper";
    if (normalizedWeapon === "pistol") {
      if (normalizedTeam === "t") return "glock";
      if (normalizedTeam === "ct") return "usp";
      return "pistol";
    }
    if (normalizedWeapon === "rifle") {
      if (normalizedTeam === "t") return "ak47";
      if (normalizedTeam === "ct") return "m4a1";
      return "rifle";
    }

    return normalizedWeapon;
  }

  setTeams(teams) {
    const source =
      Array.isArray(teams) && teams.length > 0 ? teams : this.getDefaultTeams();
    const ordered = [...source].sort((a, b) => {
      const rank = { ct: 0, t: 1 };
      return (
        (rank[this.normalizeTeamId(a.id)] ?? 99) -
        (rank[this.normalizeTeamId(b.id)] ?? 99)
      );
    });

    this.teams.clear();
    ordered.forEach((team) => {
      const normalizedId = this.normalizeTeamId(team.id);
      this.teams.set(normalizedId, {
        ...team,
        id: normalizedId,
        short_name: team.short_name || (normalizedId === "ct" ? "CT" : "T"),
        model: team.model || normalizedId,
        score: team.score || 0,
        player_count: team.player_count || 0,
      });
    });

    this.recalculatePlayerCounts();
  }

  recalculatePlayerCounts() {
    this.teams.forEach((team) => {
      team.player_count = 0;
    });

    for (const teamId of this.playerTeam.values()) {
      const team = this.teams.get(teamId);
      if (team) {
        team.player_count += 1;
      }
    }
  }

  getTeam(teamId) {
    return this.teams.get(this.normalizeTeamId(teamId));
  }

  getAllTeams() {
    return Array.from(this.teams.values());
  }

  setPlayerTeam(playerId, teamId) {
    const normalizedTeam = this.normalizeTeamId(teamId);
    if (!normalizedTeam || !this.teams.has(normalizedTeam)) {
      return;
    }

    this.playerTeam.set(playerId, normalizedTeam);
    this.recalculatePlayerCounts();
  }

  removePlayer(playerId) {
    this.playerTeam.delete(playerId);
    this.recalculatePlayerCounts();
  }

  syncPlayers(players) {
    this.playerTeam.clear();
    (players || []).forEach((player) => {
      if (player.team) {
        this.setPlayerTeam(player.id || player.player_id, player.team);
      }
    });
    this.recalculatePlayerCounts();
  }

  getPlayerTeam(playerId) {
    const teamId = this.playerTeam.get(playerId);
    return this.teams.get(teamId);
  }

  getTeamPlayers(teamId) {
    const normalizedTeam = this.normalizeTeamId(teamId);
    const players = [];
    for (const [playerId, currentTeam] of this.playerTeam.entries()) {
      if (currentTeam === normalizedTeam) {
        players.push(playerId);
      }
    }
    return players;
  }

  updateScore(teamId, score) {
    const team = this.getTeam(teamId);
    if (team) {
      team.score = score;
    }
  }

  canUseWeapon(teamId, weaponId) {
    const normalizedTeam = this.normalizeTeamId(teamId);
    if (!normalizedTeam) return true;
    const normalizedWeapon = this.normalizeWeaponId(normalizedTeam, weaponId);
    const allowed = this.teamWeapons[normalizedTeam] || [];
    return allowed.includes(normalizedWeapon);
  }

  getAvailableWeapons(teamId) {
    const normalizedTeam = this.normalizeTeamId(teamId);
    return this.teamWeapons[normalizedTeam] || [];
  }

  getDefaultWeapon(teamId) {
    return this.normalizeTeamId(teamId) === "t" ? "glock" : "usp";
  }

  getPrimaryWeapon(teamId) {
    return this.normalizeTeamId(teamId) === "t" ? "ak47" : "m4a1";
  }

  getSupportWeapon(teamId) {
    return this.normalizeTeamId(teamId) === "t" ? "galil" : "famas";
  }

  getWinningTeam() {
    let winner = null;
    for (const team of this.teams.values()) {
      if (!winner || team.score > winner.score) {
        winner = team;
      }
    }
    return winner;
  }
}

class TeamSelectUI {
  constructor(container, teamSystem) {
    this.container = container;
    this.teamSystem = teamSystem;
    this.element = null;
    this.onSelect = null;
  }

  show() {
    document.exitPointerLock?.();

    if (this.element) {
      this.render();
      this.element.style.display = "flex";
      return;
    }

    this.element = document.createElement("div");
    this.element.className = "team-select";
    this.element.style.cssText = `
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.92);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 400;
            padding: 24px;
        `;
    this.element.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    this.render();
    this.container.appendChild(this.element);
  }

  render() {
    if (!this.element) return;
    const teams = this.teamSystem.getAllTeams();

    this.element.innerHTML = `
            <h2 style="margin: 0 0 28px 0; color: white; font-size: 34px; letter-spacing: 0.08em;">CHOOSE YOUR SIDE</h2>
            <div style="display: flex; gap: 28px; flex-wrap: wrap; justify-content: center;">
                ${teams
                  .map(
                    (team) => `
                    <div class="team-card" data-id="${team.id}" style="
                        width: 280px;
                        padding: 28px;
                        background: linear-gradient(160deg, ${team.color}22, rgba(12, 12, 12, 0.9));
                        border: 2px solid ${team.color};
                        border-radius: 16px;
                        cursor: pointer;
                        text-align: left;
                        transition: transform 0.18s ease, box-shadow 0.18s ease;
                        box-shadow: 0 0 0 rgba(0,0,0,0);
                    ">
                        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
                            <span style="font-size: 42px; font-weight: 800; color: ${team.color};">${team.short_name}</span>
                            <span style="font-size: 14px; color: #ddd;">${team.player_count || 0}/${team.max_players}</span>
                        </div>
                        <h3 style="margin: 0 0 10px 0; color: white; font-size: 20px;">${team.name}</h3>
                        <div style="color: #bdbdbd; font-size: 14px; line-height: 1.6; margin-bottom: 14px;">
                            ${this.teamSystem
                              .getAvailableWeapons(team.id)
                              .map((weapon) => weapon.toUpperCase())
                              .join(" · ")}
                        </div>
                        <div style="color: ${team.color}; font-size: 14px; font-weight: 700;">
                            Rounds Won: ${team.score || 0}
                        </div>
                    </div>
                `,
                  )
                  .join("")}
            </div>

            <button id="autoAssign" style="
                margin-top: 30px;
                padding: 14px 34px;
                font-size: 16px;
                letter-spacing: 0.06em;
                background: #161616;
                border: 2px solid #666;
                border-radius: 999px;
                color: white;
                cursor: pointer;
            ">AUTO-ASSIGN</button>
        `;

    this.bindEvents();
  }

  bindEvents() {
    if (!this.element) return;

    this.element.querySelectorAll(".team-card").forEach((card) => {
      card.addEventListener("click", () => {
        const teamId = card.dataset.id;
        this.hide();
        if (this.onSelect) {
          this.onSelect(teamId);
        }
      });

      card.addEventListener("mouseenter", () => {
        card.style.transform = "translateY(-4px)";
        card.style.boxShadow = "0 12px 28px rgba(0, 0, 0, 0.35)";
      });

      card.addEventListener("mouseleave", () => {
        card.style.transform = "translateY(0)";
        card.style.boxShadow = "0 0 0 rgba(0, 0, 0, 0)";
      });
    });

    this.element.querySelector("#autoAssign")?.addEventListener("click", () => {
      this.hide();
      if (this.onSelect) {
        this.onSelect("auto");
      }
    });
  }

  hide() {
    if (this.element) {
      this.element.style.display = "none";
    }
  }
}

class TeamScoreUI {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.teams = [];
  }

  show(teams) {
    this.teams = teams || [];

    if (!this.element) {
      this.element = document.createElement("div");
      this.element.className = "team-score";
      this.element.style.cssText = `
                position: absolute;
                top: 12px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                align-items: center;
                gap: 18px;
                padding: 10px 22px;
                background: rgba(0, 0, 0, 0.7);
                border-radius: 999px;
                z-index: 110;
                border: 1px solid rgba(255,255,255,0.1);
            `;
      this.container.appendChild(this.element);
    }

    this.render();
  }

  render() {
    if (!this.element) return;
    const winner = this.getWinningTeam();

    this.element.innerHTML = this.teams
      .map((team) => {
        const isWinning = winner && winner.id === team.id;
        return `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="
                        color: ${team.color};
                        font-size: 14px;
                        font-weight: 800;
                        letter-spacing: 0.08em;
                        text-shadow: ${isWinning ? `0 0 12px ${team.color}` : "none"};
                    ">${team.short_name || team.id.toUpperCase()}</span>
                    <span style="color: white; font-size: 24px; font-weight: 800;">${team.score || 0}</span>
                </div>
            `;
      })
      .join('<span style="color: #777; font-size: 18px;">|</span>');
  }

  getWinningTeam() {
    if (this.teams.length === 0) return null;
    return this.teams.reduce((a, b) =>
      (a.score || 0) > (b.score || 0) ? a : b,
    );
  }

  hide() {
    if (this.element) {
      this.element.style.display = "none";
    }
  }

  updateTeams(teams) {
    this.teams = teams || [];
    this.render();
  }
}

window.TeamSystem = TeamSystem;
window.TeamSelectUI = TeamSelectUI;
window.TeamScoreUI = TeamScoreUI;
