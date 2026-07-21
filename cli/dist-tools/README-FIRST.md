# Sherlock CLI — Quick Start Guide

Welcome! **Sherlock** is a tool that analyzes evidence videos and images and gives each UX heuristic a score (1 to 5) with a justification. You run everything from the **Terminal** — no browser, no coding.

You only need to install it **once**. After that, just use it.

---

## Step 1 — Install Node.js (one time only)

Sherlock needs a free program called **Node.js**.

1. Go to: **https://nodejs.org**
2. Download the **LTS** version (the left-hand button).
3. Open the downloaded file and click **Next → Next → Finish**.

> If you already have Node.js installed, you can skip this step.

---

## Step 2 — Install Sherlock (one time only)

1. **Unzip** the `sherlock-cli.zip` file (right-click → Extract).
2. Open the folder that appears and **double-click** the installer for your system:
   - **Mac:** `Instalar (Mac).command`
   - **Windows:** `Instalar (Windows).bat`
3. A black window will open and do everything on its own. When it says **"Pronto! Instalação concluída"** (Done! Installation complete), close the window.

> **On Mac**, the first time you run it the system may block the file. If that happens:
> go to **System Settings → Privacy & Security**, scroll to the bottom and click **"Open Anyway"**. Then double-click the installer again.

After installing, **close and reopen the Terminal** and type:

```
sherlock projects
```

If you see the list of projects (retail6, finance5, rnortham1), you're all set! 🎉

---

## Step 3 — Daily use

### 3.1 — Open the Terminal **in the folder where your videos are**

- **Mac:** open Terminal and **drag the videos folder onto the Terminal window** (or right-click the folder → *New Terminal at Folder*).
- **Windows:** open the videos folder in File Explorer, click the **address bar**, type `cmd` and press Enter.

### 3.2 — Analyze a video

The command is: `sherlock` + the video name + the heuristic number.

```
sherlock video.mp4 3.16
```

Useful examples:

```
sherlock video.mp4 3.10,3.16          (several heuristics at once)
sherlock v2-web-m 3.10                 (partial name: finds "v2-web-mobile.mov")
sherlock -p rnortham1 video.mp4 3.16   (choose the project with -p)
```

### 3.3 — The easiest way: **batch analysis**

Instead of running them one by one, create a simple text file (e.g. `list.txt`) with one line per analysis:

```
3.10 search-video.mp4
3.16 checkout-video.mp4
2.2 cindy.mp4,miranda.mp4
```

Then run **a single command**:

```
sherlock batch list.txt
```

The result is saved automatically to `results_list.txt`, in the same folder.

> See more ready-made list templates in the `examples/` folder, and the full documentation in `readme.md`.

---

## Where are the results saved?

- Batch analysis: saved automatically to `results_<file-name>.txt`.
- Single analysis: shown in the Terminal. To save it to a file, add `-o result.txt`:

```
sherlock video.mp4 3.16 -o result.txt
```

---

## I received updated heuristics or projects. Now what?

- **Heuristics** update **automatically** every time you run Sherlock (it fetches the latest version on its own). You don't need to do anything.
- If someone sends you an **updated project folder** (e.g. `rnortham1`), just drop it into the `projects/` folder of your installation, replacing the old one.

---

## Common issues

| What happened | What to do |
| --- | --- |
| `command not found: sherlock` (or "is not recognized") | Close and reopen the Terminal. If it persists, run the installer again. |
| A yellow warning about "syncing heuristics" appeared | Normal — it means the heuristics server is down or you're not on the VPN. Sherlock keeps working with the heuristics bundled in the package. |
| "Node.js not found" | Go back to **Step 1** and install Node.js. |
| An error you don't understand | Take a screenshot of the Terminal and send it to whoever gave you the program. |
