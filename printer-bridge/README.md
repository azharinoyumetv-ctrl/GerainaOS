# GerainaOS Printer Bridge

Run this on the PC that's on the same Wi-Fi/network as your network (LAN) thermal receipt printer. It's only needed for **Printer Jaringan (Mode B)** in Settings > Printer. If you print via USB/local printer through your browser's print dialog (Mode A), you don't need this at all.

## Why this exists

GerainaOS runs in your browser, and its server runs in the cloud. Neither can open a direct connection to a printer sitting on your shop's own Wi-Fi network — browsers aren't allowed to open raw network sockets, and the cloud server isn't on your local network. This bridge runs on a PC that *is* on your shop's network, and relays print jobs from your browser to the printer.

## Requirements

Python 3.8 or newer. Most Windows, Mac, and Linux machines already have it. Check with:

```
python --version
```

No extra packages needed.

## Running it

```
python bridge.py
```

Leave this window open while you're using the till. You'll see:

```
GerainaOS Printer Bridge listening on http://127.0.0.1:9899
```

## Setting it up in GerainaOS

1. Go to **Pengaturan > Printer**.
2. Set **Mode Printer** to **Jaringan (Network)**.
3. Enter your printer's **IP Address** and **Port** (almost always `9100`).
4. Leave **Bridge Port** as `9899` unless you changed `GERAINA_BRIDGE_PORT`.
5. Click **Kirim Test Print** — you should get a test receipt.

## Finding your printer's IP address

Most thermal printers have a self-test button combo (check your printer's manual) that prints out its current network settings, including its IP address. Alternatively, check your router's connected-devices list for the printer.

## Running it automatically on startup (optional)

If you don't want to manually start this every day:
- **Windows**: put a shortcut to `bridge.py` (or a `.bat` file that runs `python bridge.py`) in your Startup folder (`shell:startup`).
- **Mac**: add it as a Login Item in System Settings.
- **Linux**: add a systemd user service or an autostart `.desktop` entry.

## Troubleshooting

- **"Gagal mengirim test print" in GerainaOS**: make sure this script is still running, and that `Bridge Port` in Settings matches the port this script printed on startup.
- **"Gagal konek ke printer"**: double-check the printer's IP and port, and that this PC and the printer are on the same network.
- **Nothing prints but no error either**: some printers need a specific codepage; open an issue with your printer's model so the ESC/POS output can be tuned.
