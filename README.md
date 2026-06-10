<div align="center">

# ✈️ AviaTarr — Live Tournament Arena

**A real-time, multiplayer "crash"-style tournament game with live betting, cash-out mechanics, leaderboards, and a complete tournament management engine.**

![Status](https://img.shields.io/badge/status-production-success)
![Type](https://img.shields.io/badge/type-Real--Time%20Game-ff4757)

[![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5](https://img.shields.io/badge/HTML5-Canvas-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)

</div>

---

## Overview

**AviaTarr** is a browser-based, real-time tournament arena built around an Aviator-style multiplier game. Players join live tournaments, place bets, and cash out before the round ends to climb a competitive leaderboard for prize pools. Behind it sits a complete, custom-built **Tournament Engine** that manages tournament data, player state, round logic, simulation, and an admin control system.

> Built by **[DG Technology](https://dgtechnology.com)** — engineered by Faiz Ullah.

---

## Key Features

- ✈️ **Live multiplier game loop** — real-time round-based gameplay with rising multipliers and timed cash-outs
- 🏆 **Tournament system** — scheduled tournaments with prize pools, entry, and winner determination
- 📊 **Live leaderboard** — players ranked by performance, updated each round
- 👤 **Player accounts** — authentication, profiles, balances, and play history
- 🛠️ **Admin dashboard** — create and manage tournaments, monitor players, control the game
- 💾 **Persistent state engine** — a structured `TournamentEngine` class managing tournaments, players, and history
- 📱 **Responsive arena UI** — playable across devices

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Core** | Vanilla JavaScript (ES6+), modular architecture |
| **Game Engine** | Custom `TournamentEngine` class |
| **Rendering** | HTML5 + CSS3 animations |
| **State** | Structured client-side persistence |
| **Pages** | Landing, Auth, Dashboard, Game, Tournament, Leaderboard, Admin |

---

## Architecture

```
aviatarr/
├── index.html              # Landing / arena entry
├── auth.html               # Player authentication
├── dashboard.html          # Player dashboard
├── game.html + game.js     # Live multiplier game loop
├── tournament.html         # Tournament browser & join
├── tournament-engine.js    # Core engine: data, logic, admin, simulation
├── leaderboard.html        # Rankings
├── admin.html              # Tournament management panel
└── shared.js               # Shared utilities across pages
```

The heart of the project is **`tournament-engine.js`** — a self-contained engine that seeds tournaments and players, manages tournament lifecycle and history, and exposes admin operations. Game logic is cleanly separated from presentation.

---

> ⚠️ **Note:** This project demonstrates real-time game architecture, tournament systems, and state management. It is a technical showcase of live multiplayer game mechanics.

---

<div align="center">

**Designed & engineered by Faiz Ullah**
Game Developer · Full-Stack Engineer · Founder of [DG Technology](https://dgtechnology.com)

📧 contact@faizullah.pk · 🌐 [faizullah.pk](https://faizullah.pk)

*Built with precision by DG Technology* 💙

</div>
