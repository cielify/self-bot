<div align="center">

```
  ██████╗ ███████╗███████╗██╗   ██╗    ███╗   ███╗ █████╗ ███╗   ██╗██╗ █████╗
  ██╔═══██╗╚════██║██╔════╝██║   ██║    ████╗ ████║██╔══██╗████╗  ██║██║██╔══██╗
  ██║   ██║    ██╔╝█████╗  ██║   ██║    ██╔████╔██║███████║██╔██╗ ██║██║███████║
  ██║   ██║   ██╔╝ ██╔══╝  ██║   ██║    ██║╚██╔╝██║██╔══██║██║╚██╗██║██║██╔══██╗
  ╚██████╔╝   ██║  ███████╗╚██████╔╝    ██║ ╚═╝ ██║██║  ██║██║ ╚████║██║██║  ██║
   ╚═════╝    ╚═╝  ╚══════╝ ╚═════╝     ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝
```

**A lightweight Discord utility toolkit: bulk cleanup, channel exports, deleted-message viewing, lookups, and friend automation, all driven by simple `.` commands.**

![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Discord-5865F2?logo=discord&logoColor=white)

</div>

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Terminal Mode](#terminal-mode)
- [Configuration](#configuration)
- [File Layout](#file-layout)
- [Disclaimer](#disclaimer)

---

## Features

- **Purge:** bulk-delete your own recent messages (up to 50 at a time)
- **Export:** save any channel's message history to a local file
- **Snipe:** view messages that were deleted, with pagination
- **Lookups:** pull up details on any user or server by ID or mention
- **Friend automation:** auto-accept friend requests and get alerts when mutual friends join
- **Latency check:** see your gateway ping at a glance
- **Persistent settings:** toggles survive restarts via a local `config.json`
- **Session logs:** mutuals, friend requests, and exports are logged per session

---

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer
- npm
- A Discord account/token for the tool to run under

---

## Quick Start

```bash
# 1. Clone the repo
git clone <repo-url>
cd ozeu-mania

# 2. Install dependencies
npm install

# 3. Run it
node discord-bot.js
```

On first launch, settings and log folders are created automatically in `~/ozeu-mania/`.

---

## Commands

Run commands from any Discord channel using the `.` prefix.

### Messages

| Command           | Description                                   |
| ----------------- | --------------------------------------------- |
| `.purge <1-50>`   | Delete your most recent messages              |
| `.export [ch_id]` | Save a channel's messages to a file           |
| `.s [ch_id]`      | View sniped (deleted) messages                |

### Lookups

| Command    | Description                       |
| ---------- | --------------------------------- |
| `.u <id/@>`| Look up a user by ID or mention   |
| `.si [id]` | Look up a server                  |

### Friends

| Command        | Description                          |
| -------------- | ------------------------------------ |
| `.d` / `.mutual` | Toggle mutual-friend join alerts   |
| `.a` / `.fq`   | Toggle auto friend accept            |

### Utility

| Command | Description              |
| ------- | ------------------------ |
| `.ping` | Check gateway latency    |
| `.help` | Show the command menu    |

> Arguments in `<angle brackets>` are required; arguments in `[square brackets]` are optional. When `[ch_id]` is omitted, the current channel is used.

---

## Terminal Mode

Commands can also be entered directly in the terminal, where you can target a channel explicitly:

```
.purge  <channel_id> <1-50>
.s      <channel_id> [page]
.export <channel_id>
```

**Examples**

```
.purge 123456789012345678 25
.s 123456789012345678 2
.export 123456789012345678
```

---

## Configuration

| Setting        | Toggled by           | Description                               |
| -------------- | -------------------- | ----------------------------------------- |
| `autoAccept`   | `.a` / `.fq`         | Automatically accept incoming friend requests |
| `mutualDetect` | `.d` / `.mutual`     | Alert when a mutual friend joins          |

You can also edit the file by hand while the tool is stopped.


---

## Disclaimer

This tool is for personal and educational use. Automating a user account (self-botting) is against [Discord's Terms of Service](https://discord.com/terms) and can result in your account being limited or terminated. Use it at your own risk, never share your token, and only export or log content you have the right to access. The authors are not responsible for any consequences of using this software.
