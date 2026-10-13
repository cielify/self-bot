# Ozeu Mania

```
  ██████╗ ███████╗███████╗██╗   ██╗    ███╗   ███╗ █████╗ ███╗   ██╗██╗ █████╗
  ██╔═══██╗╚════██║██╔════╝██║   ██║    ████╗ ████║██╔══██╗████╗  ██║██║██╔══██╗
  ██║   ██║    ██╔╝█████╗  ██║   ██║    ██╔████╔██║███████║██╔██╗ ██║██║███████║
  ██║   ██║   ██╔╝ ██╔══╝  ██║   ██║    ██║╚██╔╝██║██╔══██║██║╚██╗██║██║██╔══██╗
  ╚██████╔╝   ██║  ███████╗╚██████╔╝    ██║ ╚═╝ ██║██║  ██║██║ ╚████║██║██║  ██║
   ╚═════╝    ╚═╝  ╚══════╝ ╚═════╝     ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝
```

## Setup

```bash
npm install
node discord-bot.js
```

## Commands

| Command              | Description                      |
|----------------------|----------------------------------|
| `.purge <1-50>`      | Delete your recent messages       |
| `.export [ch_id]`    | Save channel messages to file     |
| `.s [ch_id]`         | View sniped deleted messages      |
| `.u <id/@>`          | Look up a user                    |
| `.si [id]`           | Look up a server                  |
| `.ping`              | Check gateway latency             |
| `.d / .mutual`       | Toggle mutual friend join alerts  |
| `.a / .fq`           | Toggle auto friend accept         |
| `.help`              | Show command menu                 |

**Terminal extended syntax:**
```
.purge <channel_id> <1-50>
.s     <channel_id> [page]
.export <channel_id>
```

## Files saved

All exports and logs go to `~/ozeu-mania/`:
- `exports/` — channel message exports
- `logs/<session>/` — mutuals, friend requests, exports log
- `config.json` — persisted settings (autoAccept, mutualDetect)
