const BUY_MENU_CATALOG = [
  {
    id: "pistols",
    label: "Pistols",
    items: [
      {
        id: "glock",
        name: "Glock",
        price: 400,
        description: "T side starter pistol",
        team: "t",
      },
      {
        id: "usp",
        name: "USP",
        price: 500,
        description: "CT side starter pistol",
        team: "ct",
      },
      {
        id: "deagle",
        name: "Deagle",
        price: 650,
        description: "High damage sidearm",
      },
    ],
  },
  {
    id: "smgs",
    label: "SMGs",
    items: [
      {
        id: "mp5",
        name: "MP5",
        price: 1500,
        description: "Balanced close-range spray",
      },
      {
        id: "p90",
        name: "P90",
        price: 2350,
        description: "Fast fire with a large magazine",
      },
    ],
  },
  {
    id: "rifles",
    label: "Rifles",
    items: [
      {
        id: "ak47",
        name: "AK47",
        price: 2500,
        description: "T side rifle with heavy damage",
        team: "t",
      },
      {
        id: "m4a1",
        name: "M4A1",
        price: 3100,
        description: "CT side rifle with control",
        team: "ct",
      },
      {
        id: "famas",
        name: "Famas",
        price: 2250,
        description: "Affordable CT rifle",
        team: "ct",
      },
      {
        id: "galil",
        name: "Galil",
        price: 2000,
        description: "Affordable T rifle",
        team: "t",
      },
    ],
  },
  {
    id: "sniper",
    label: "Sniper",
    items: [
      {
        id: "awp",
        name: "AWP",
        price: 4750,
        description: "High-risk one-shot rifle",
      },
    ],
  },
  {
    id: "equipment",
    label: "Equipment",
    items: [
      {
        id: "kevlar",
        name: "Kevlar",
        price: 650,
        description: "Body armor",
      },
      {
        id: "kevlar_helmet",
        name: "Helmet + Kevlar",
        price: 1000,
        description: "Armor with helmet protection",
      },
      {
        id: "flashbang",
        name: "Flash",
        price: 200,
        description: "White-out utility",
      },
      {
        id: "he_grenade",
        name: "HE",
        price: 300,
        description: "Explosive grenade",
      },
      {
        id: "smoke",
        name: "Smoke",
        price: 300,
        description: "Vision denial",
      },
    ],
  },
];

function findBuyMenuItem(itemId) {
  for (const category of BUY_MENU_CATALOG) {
    const item = category.items.find((entry) => entry.id === itemId);
    if (item) return item;
  }
  return null;
}

class BuyMenuUI {
  constructor(container) {
    this.container = container || document.body;
    this.element = null;
    this.selectedCategory = BUY_MENU_CATALOG[0].id;
  }

  ensureElement() {
    if (this.element) return;

    this.element = document.createElement("div");
    this.element.className = "buy-menu-overlay";
    this.element.style.cssText = `
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(5, 7, 10, 0.78);
      backdrop-filter: blur(6px);
      z-index: 350;
      pointer-events: auto;
      padding: 24px;
    `;

    this.container.appendChild(this.element);
  }

  getPlayer() {
    return window.game?.player || null;
  }

  getMoney() {
    return Math.max(0, Math.floor(this.getPlayer()?.money || 0));
  }

  getTeam() {
    return window.teamSystem?.normalizeTeamId(this.getPlayer()?.team || "") || "";
  }

  getRoundState() {
    return window.roundState || null;
  }

  isVisible() {
    return Boolean(this.element && this.element.style.display !== "none");
  }

  isTeamLocked(item) {
    const team = this.getTeam();
    return Boolean(item.team && team && item.team !== team);
  }

  canAfford(item) {
    return this.getMoney() >= item.price;
  }

  canUseBuyWindow() {
    const roundState = this.getRoundState();
    if (!roundState) return true;
    return roundState.can_buy !== false;
  }

  canPurchase(item) {
    return (
      Boolean(this.getTeam()) &&
      this.canUseBuyWindow() &&
      !this.isTeamLocked(item) &&
      this.canAfford(item) &&
      Boolean(window.network?.connected)
    );
  }

  getStatusLabel(item) {
    if (!this.getTeam()) return "JOIN A TEAM";
    if (!this.canUseBuyWindow()) return "BUY CLOSED";
    if (this.isTeamLocked(item)) return `${item.team.toUpperCase()} ONLY`;
    if (!this.canAfford(item)) return "NOT ENOUGH";
    return "BUY";
  }

  show() {
    if (!this.canUseBuyWindow()) {
      window.uiManager?.showMessage("Buy time is over", "error");
      return;
    }
    this.ensureElement();
    document.exitPointerLock?.();
    this.element.style.display = "flex";
    this.render();
  }

  hide() {
    if (!this.element) return;
    this.element.style.display = "none";
  }

  toggle() {
    if (this.isVisible()) {
      this.hide();
      return;
    }
    this.show();
  }

  refresh() {
    if (!this.isVisible()) return;
    this.render();
  }

  render() {
    this.ensureElement();

    const selectedCategory =
      BUY_MENU_CATALOG.find((category) => category.id === this.selectedCategory) ||
      BUY_MENU_CATALOG[0];
    const team = this.getTeam();
    const money = this.getMoney();

    this.element.innerHTML = `
      <div style="
        width: min(920px, 100%);
        max-height: min(720px, 100%);
        display: grid;
        grid-template-columns: 210px 1fr;
        background: linear-gradient(155deg, rgba(20, 24, 29, 0.98), rgba(10, 12, 15, 0.98));
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 28px 70px rgba(0, 0, 0, 0.45);
        overflow: hidden;
      ">
        <div style="
          padding: 22px 18px;
          background: linear-gradient(180deg, rgba(32, 38, 46, 0.96), rgba(16, 18, 22, 0.96));
          border-right: 1px solid rgba(255, 255, 255, 0.06);
        ">
          <div style="margin-bottom: 24px;">
            <div style="font-size: 12px; color: #8f97a3; letter-spacing: 0.16em; text-transform: uppercase;">Buy Menu</div>
            <div style="margin-top: 8px; font-size: 36px; font-weight: 800; color: #d9e3f0;">$${money}</div>
            <div style="margin-top: 8px; font-size: 13px; color: ${team === "ct" ? "#6fb6ff" : team === "t" ? "#ff9a6a" : "#8f97a3"}; letter-spacing: 0.14em; text-transform: uppercase;">
              ${team ? `Side: ${team}` : "Select a team first"}
            </div>
          </div>
          <div style="display: grid; gap: 8px;">
            ${BUY_MENU_CATALOG.map(
              (category) => `
                <button
                  class="buy-category"
                  data-category="${category.id}"
                  style="
                    width: 100%;
                    text-align: left;
                    padding: 12px 14px;
                    border: 1px solid ${this.selectedCategory === category.id ? "rgba(255, 206, 120, 0.55)" : "rgba(255, 255, 255, 0.05)"};
                    background: ${this.selectedCategory === category.id ? "linear-gradient(135deg, rgba(188, 118, 44, 0.28), rgba(255, 206, 120, 0.12))" : "rgba(255, 255, 255, 0.02)"};
                    color: ${this.selectedCategory === category.id ? "#ffe1b3" : "#c2cad6"};
                    font-size: 14px;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    cursor: pointer;
                  "
                >${category.label}</button>
              `,
            ).join("")}
          </div>
          <div style="margin-top: 22px; font-size: 12px; color: #7c8490; line-height: 1.7;">
            Press <strong style="color:#d9e3f0;">B</strong> to open or close the menu.
          </div>
        </div>
        <div style="display: flex; flex-direction: column; min-height: 0;">
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px 18px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          ">
            <div>
              <div style="font-size: 13px; color: #7f8894; letter-spacing: 0.18em; text-transform: uppercase;">Category</div>
              <div style="margin-top: 8px; font-size: 28px; font-weight: 800; color: #f3f5f7;">${selectedCategory.label}</div>
            </div>
            <button
              id="buy-menu-close"
              style="
                border: 1px solid rgba(255,255,255,0.12);
                background: rgba(255,255,255,0.04);
                color: #e3e7ed;
                padding: 10px 16px;
                cursor: pointer;
                font-size: 12px;
                letter-spacing: 0.16em;
                text-transform: uppercase;
              "
            >Close</button>
          </div>
          <div style="padding: 20px 24px 24px; overflow: auto;">
            <div style="display: grid; gap: 12px;">
              ${selectedCategory.items.map((item) => {
                const teamLocked = this.isTeamLocked(item);
                const affordable = this.canAfford(item);
                const buyable = this.canPurchase(item);
                const muted = !buyable;
                return `
                  <button
                    class="buy-item"
                    data-item-id="${item.id}"
                    ${buyable ? "" : 'data-disabled="true"'}
                    style="
                      display: grid;
                      grid-template-columns: 1fr auto auto;
                      gap: 18px;
                      align-items: center;
                      width: 100%;
                      text-align: left;
                      padding: 16px 18px;
                      border: 1px solid ${buyable ? "rgba(255, 212, 143, 0.22)" : "rgba(255,255,255,0.06)"};
                      background: ${buyable ? "linear-gradient(135deg, rgba(63, 42, 20, 0.55), rgba(26, 28, 34, 0.95))" : "rgba(18, 20, 24, 0.85)"};
                      color: ${muted ? "#707883" : "#eef2f5"};
                      cursor: ${buyable ? "pointer" : "not-allowed"};
                      opacity: ${muted ? 0.56 : 1};
                    "
                  >
                    <div>
                      <div style="font-size: 18px; font-weight: 800; letter-spacing: 0.03em;">${item.name}</div>
                      <div style="margin-top: 6px; font-size: 13px; color: ${muted ? "#6c737d" : "#9da5b1"};">${item.description}</div>
                    </div>
                    <div style="text-align: right;">
                      <div style="font-size: 22px; font-weight: 800; color: ${affordable ? "#7cff9a" : "#ff7a7a"};">$${item.price}</div>
                      ${item.team ? `<div style="margin-top: 6px; font-size: 11px; color: ${item.team === "ct" ? "#6fb6ff" : "#ff9a6a"}; letter-spacing: 0.14em; text-transform: uppercase;">${item.team} side</div>` : ""}
                    </div>
                    <div style="
                      min-width: 104px;
                      padding: 8px 10px;
                      border: 1px solid ${buyable ? "rgba(255, 218, 161, 0.35)" : "rgba(255,255,255,0.08)"};
                      background: ${buyable ? "rgba(255, 202, 128, 0.08)" : "rgba(255,255,255,0.02)"};
                      font-size: 11px;
                      font-weight: 800;
                      letter-spacing: 0.14em;
                      text-align: center;
                      text-transform: uppercase;
                      color: ${buyable ? "#ffd8a0" : teamLocked ? "#ffb18e" : "#8a929d"};
                    ">${this.getStatusLabel(item)}</div>
                  </button>
                `;
              }).join("")}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.element
      .querySelectorAll(".buy-category")
      .forEach((button) =>
        button.addEventListener("click", () => {
          this.selectedCategory = button.dataset.category;
          this.render();
        }),
      );

    this.element
      .querySelector("#buy-menu-close")
      ?.addEventListener("click", () => this.hide());

    this.element.querySelectorAll(".buy-item").forEach((button) => {
      button.addEventListener("click", () => {
        const item = findBuyMenuItem(button.dataset.itemId);
        if (!item) return;

        if (!this.getTeam()) {
          window.uiManager?.showMessage("Join a team before buying", "error");
          return;
        }
        if (!this.canUseBuyWindow()) {
          window.uiManager?.showMessage("Buy time is over", "error");
          return;
        }
        if (this.isTeamLocked(item)) {
          window.uiManager?.showMessage(
            `That item is for ${item.team.toUpperCase()} only`,
            "error",
          );
          return;
        }
        if (!this.canAfford(item)) {
          window.uiManager?.showMessage("Not enough money", "error");
          return;
        }
        if (!window.network?.connected) {
          window.uiManager?.showMessage("Network unavailable", "error");
          return;
        }

        window.network.send("buy", { item_id: item.id });
      });
    });
  }
}

window.BUY_MENU_CATALOG = BUY_MENU_CATALOG;
window.findBuyMenuItem = findBuyMenuItem;
window.BuyMenuUI = BuyMenuUI;
