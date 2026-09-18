const { app, BrowserWindow, dialog, shell, ipcMain, Tray, Menu } = require("electron");
const { spawn } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const http = require("http");

let backendProcess = null;
let backendLogPath = null;
let tray = null;
let activeTarget = null;
let language = "fr";
let quitting = false;
const text = (fr, en) => language === "fr" ? fr : en;
function studioUrl(port) { return `${buildBackendUrl(port)}/?lang=${language}`; }
function saveLanguage(value) {
  if (!["fr", "en"].includes(value)) throw Error("Unsupported language");
  language = value;
  fs.writeFileSync(path.join(app.getPath("userData"), "language.json"), JSON.stringify(value));
  updateTray();
}
function updateTray() {
  if (!tray) return;
  tray.setToolTip(text("AlgoArena · moteur local actif", "AlgoArena · local engine running"));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: text("Ouvrir le navigateur", "Open browser"), click: () => shell.openExternal(studioUrl(resolveBackendPort())) },
    { label: text("Ouvrir l’application PC", "Open desktop app"), click: () => createWindow(resolveAppRoot(), resolveBackendPort()).catch(error => dialog.showErrorBox("AlgoArena", String(error))) },
    { type: "separator" },
    { label: text("Tout arrêter et quitter", "Stop everything and quit"), click: () => app.quit() }
  ]));
}
function ensureTray() {
  if (tray) return;
  tray = new Tray(path.join(__dirname, "assets", process.platform === "win32" ? "icon.ico" : "icon.png"));
  updateTray();
  tray.on("double-click", () => shell.openExternal(studioUrl(resolveBackendPort())));
}
const DEFAULT_DESKTOP_BACKEND_PORT = 8765;

function resolveBackendPort() {
  const rawPort = process.env.ALGOARENA_DESKTOP_PORT;
  const parsed = rawPort ? Number.parseInt(rawPort, 10) : DEFAULT_DESKTOP_BACKEND_PORT;
  if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) {
    return parsed;
  }
  return DEFAULT_DESKTOP_BACKEND_PORT;
}

function buildBackendUrl(port = resolveBackendPort()) {
  return `http://127.0.0.1:${port}`;
}

function sanitizeFileName(fileName) {
  const fallback = "algoarena-export.bin";
  if (!fileName || typeof fileName !== "string") {
    return fallback;
  }
  const sanitized = fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim();
  return sanitized || fallback;
}

function buildUniqueDownloadPath(downloadsDir, fileName) {
  const safeName = sanitizeFileName(fileName);
  const parsed = path.parse(path.join(downloadsDir, safeName));
  let candidate = path.join(parsed.dir, `${parsed.name}${parsed.ext}`);
  let index = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(parsed.dir, `${parsed.name} (${index})${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

function isBackendExportUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname !== "127.0.0.1" || parsed.port !== String(resolveBackendPort())) {
      return false;
    }
    return /^\/api\/runs\/[^/]+\/export\/(csv|pdf|latex)$/.test(parsed.pathname) || parsed.pathname === "/api/exports/bibtex";
  } catch (_) {
    return false;
  }
}

function resolveAppRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, "app") : path.resolve(__dirname, "..");
}

function resolveRuntimeRoot() {
  const runtimeRoot = path.join(app.getPath("userData"), "runtime");
  fs.mkdirSync(runtimeRoot, { recursive: true });
  return runtimeRoot;
}

function resolvePythonBootstrapCommand(appRoot) {
  const envPath = process.env.ALGOARENA_PYTHON;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const localVenvWin = path.join(appRoot, ".venv", "Scripts", "python.exe");
  const localVenvPosix = path.join(appRoot, ".venv", "bin", "python3");
  const localVenvPosixAlt = path.join(appRoot, ".venv", "bin", "python");
  const portableWin = path.join(appRoot, "desktop", "python", "python.exe");
  const portablePosix = path.join(appRoot, "desktop", "python", "bin", "python3");
  const portablePosixAlt = path.join(appRoot, "desktop", "python", "bin", "python");
  if (fs.existsSync(portableWin)) {
    return portableWin;
  }
  if (fs.existsSync(portablePosix)) {
    return portablePosix;
  }
  if (fs.existsSync(portablePosixAlt)) {
    return portablePosixAlt;
  }
  if (fs.existsSync(localVenvWin)) {
    return localVenvWin;
  }
  if (fs.existsSync(localVenvPosix)) {
    return localVenvPosix;
  }
  if (fs.existsSync(localVenvPosixAlt)) {
    return localVenvPosixAlt;
  }

  return process.platform === "win32" ? "python" : "python3";
}

function resolveRuntimeVenvPython(runtimeRoot) {
  if (process.platform === "win32") {
    return path.join(runtimeRoot, ".venv", "Scripts", "python.exe");
  }
  const py3 = path.join(runtimeRoot, ".venv", "bin", "python3");
  if (fs.existsSync(py3)) {
    return py3;
  }
  return path.join(runtimeRoot, ".venv", "bin", "python");
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
    }
    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            [
              `Command failed (${code}): ${command} ${args.join(" ")}`,
              stderr.trim(),
              stdout.trim()
            ]
              .filter(Boolean)
              .join("\n")
          )
        );
      }
    });
  });
}

function hashFileSha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function ensureDesktopRuntime(appRoot) {
  const runtimeRoot = resolveRuntimeRoot();
  const bootstrapPython = resolvePythonBootstrapCommand(appRoot);
  const bundledPythonRoot = path.join(appRoot, "desktop", "python");
  if (bootstrapPython.startsWith(bundledPythonRoot + path.sep) || !app.isPackaged) {
    try {
      await runCommand(bootstrapPython,
        ["-c", "import fastapi,uvicorn,numpy,pandas,pymoo,deap,reportlab,httpx,scipy"], { cwd: appRoot });
      // Bundled dependencies are prepared at build time: no online install or venv at first launch.
      return { runtimeRoot, runtimePython: bootstrapPython };
    } catch (error) {
      if (bootstrapPython.startsWith(bundledPythonRoot + path.sep)) {
        throw new Error(text("Le runtime Python intégré est incomplet. Réinstallez une distribution complète d'AlgoArena.", "The bundled Python runtime is incomplete. Reinstall the full AlgoArena distribution."));
      }
    }
  }
  const runtimePython = resolveRuntimeVenvPython(runtimeRoot);
  const requirementsPath = path.join(appRoot, "backend", "requirements.txt");
  const requirementsHash = hashFileSha256(requirementsPath);
  const stampPath = path.join(runtimeRoot, "requirements.sha256");

  await runCommand(bootstrapPython, ["--version"], { cwd: appRoot }).catch(() => {
    throw new Error(
      text("Python introuvable. Installez Python 3.11+ ou définissez ALGOARENA_PYTHON vers python.exe.", "Python not found. Install Python 3.11+ or point ALGOARENA_PYTHON to python.exe.")
    );
  });

  if (!fs.existsSync(runtimePython)) {
    await runCommand(bootstrapPython, ["-m", "venv", path.join(runtimeRoot, ".venv")], { cwd: appRoot });
  }

  let mustInstallDeps = true;
  if (fs.existsSync(stampPath)) {
    const current = fs.readFileSync(stampPath, "utf8").trim();
    mustInstallDeps = current !== requirementsHash;
  }

  if (!mustInstallDeps) {
    try {
      await runCommand(
        runtimePython,
        ["-c", "import fastapi,uvicorn,numpy,pandas,pymoo,deap,reportlab,httpx"],
        { cwd: appRoot }
      );
    } catch (_) {
      mustInstallDeps = true;
    }
  }

  if (mustInstallDeps) {
    await runCommand(runtimePython, ["-m", "pip", "install", "--upgrade", "pip"], { cwd: appRoot });
    await runCommand(runtimePython, ["-m", "pip", "install", "-r", requirementsPath], { cwd: appRoot });
    fs.writeFileSync(stampPath, requirementsHash, "utf8");
  }

  return { runtimeRoot, runtimePython };
}

function checkBackendHealth(port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const request = http.get(`${buildBackendUrl(port)}/api/health`, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy();
      resolve(false);
    });

    request.on("error", () => resolve(false));
  });
}

async function waitForBackendReady(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const healthy = await checkBackendHealth(port);
    if (healthy) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return false;
}

function tailFile(filePath, maxLines = 40) {
  if (!filePath || !fs.existsSync(filePath)) {
    return "";
  }
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    return lines.slice(-maxLines).join("\n");
  } catch (_) {
    return "";
  }
}

function startBackend(appRoot, runtime, port) {
  backendLogPath = path.join(runtime.runtimeRoot, "backend.log");
  fs.writeFileSync(backendLogPath, "", "utf8");
  const logStream = fs.createWriteStream(backendLogPath, { flags: "a" });

  backendProcess = spawn(
    runtime.runtimePython,
    ["-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", String(port), "--ws", "wsproto"],
    {
      cwd: appRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONPATH: appRoot,
        ALGOARENA_RUNTIME_ROOT: runtime.runtimeRoot,
        ALGOARENA_DESKTOP_PORT: String(port)
      }
    }
  );

  backendProcess.stdout?.on("data", (chunk) => logStream.write(chunk));
  backendProcess.stderr?.on("data", (chunk) => logStream.write(chunk));
  backendProcess.on("close", () => {
    try {
      logStream.end();
    } catch (_) {
      // no-op
    }
  });

  backendProcess.on("error", async (error) => {
    await dialog.showMessageBox({
      type: "error",
      title: "AlgoArena Desktop",
      message: text("Impossible de démarrer le moteur.", "Unable to start the engine."),
      detail: String(error)
    });
  });
}

async function stopBackend() {
  if (!backendProcess) return;
  const pid = backendProcess.pid;
  backendProcess = null;

  if (!pid) return;

  if (process.platform === "win32") {
    try {
      await runCommand("taskkill", ["/PID", String(pid), "/T", "/F"]);
    } catch (_) {
      // no-op
    }
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch (_) {
    // no-op
  }
}

async function createWindow(appRoot, port, startupInfo = null) {
  const desktopTaskbarIcon = path.join(appRoot, "desktop", "assets", "icon-taskbar.ico");
  const desktopLegacyIcon = path.join(appRoot, "desktop", "assets", "icon.ico");
  const distLogo = path.join(appRoot, "frontend", "dist", "logo.png");
  const publicLogo = path.join(appRoot, "frontend", "public", "logo.png");
  const iconPath = fs.existsSync(desktopTaskbarIcon)
    ? desktopTaskbarIcon
    : fs.existsSync(desktopLegacyIcon)
      ? desktopLegacyIcon
      : fs.existsSync(distLogo)
        ? distLogo
        : publicLogo;

  const win = new BrowserWindow({
    show: process.env.ALGOARENA_HEADLESS !== "1",
    width: 1480,
    height: 900,
    minWidth: 700,
    minHeight: 520,
    title: "AlgoArena Desktop",
    autoHideMenuBar: true,
    backgroundColor: "#0b1220",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.setMenuBarVisibility(false);
  const session = win.webContents.session;
  const onWillDownload = (event, item, webContents) => {
    if (webContents !== win.webContents) {
      return;
    }
    const downloadDir = app.getPath("downloads");
    const savePath = buildUniqueDownloadPath(downloadDir, item.getFilename());
    item.setSavePath(savePath);
  };
  session.on("will-download", onWillDownload);
  win.on("closed", () => {
    session.removeListener("will-download", onWillDownload);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isBackendExportUrl(url)) {
      win.webContents.downloadURL(url);
      return { action: "deny" };
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (isBackendExportUrl(url)) {
      event.preventDefault();
      win.webContents.downloadURL(url);
      return;
    }
    if (new URL(url).origin === buildBackendUrl(port)) {
      return;
    }
    event.preventDefault();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  win.webContents.once("did-finish-load", () => {
    if (startupInfo) {
      win.webContents.send("algoarena:startup-info", startupInfo);
    }
  });

  win.webContents.session.clearCache().catch(() => {
    // no-op
  });
  try { await win.loadURL(studioUrl(port)); }
  catch (error) { win.destroy(); throw error; }
  return win;
}

async function launchStudio(target) {
  const appRoot = resolveAppRoot();
  const port = resolveBackendPort();
  if (!backendProcess) {
    if (await checkBackendHealth(port)) throw Error(text("Le port du moteur est déjà utilisé. Fermez l’autre instance d’AlgoArena.", "The engine port is already in use. Close the other AlgoArena instance."));
    const runtime = await ensureDesktopRuntime(appRoot);
    if (quitting) return;
    startBackend(appRoot, runtime, port);
    if (!await waitForBackendReady(port)) {
      await stopBackend();
      throw Error(text("Le moteur n’a pas démarré. ", "The engine failed to start. ") + tailFile(backendLogPath));
    }
  }
  if (quitting) return;
  if (target === "web") {
    ensureTray();
    await shell.openExternal(studioUrl(port));
  } else await createWindow(appRoot, port);
  activeTarget = target;
}

const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on("second-instance", () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) { win.restore(); win.show(); win.focus(); }
  else if (activeTarget === "web") void shell.openExternal(studioUrl(resolveBackendPort()));
});
if (primaryInstance) app.whenReady().then(() => {
  try { const saved = JSON.parse(fs.readFileSync(path.join(app.getPath("userData"), "language.json"), "utf8")); if (["fr", "en"].includes(saved)) language = saved; }
  catch (_) { language = app.getLocale().startsWith("fr") ? "fr" : "en"; }
  const launcher = new BrowserWindow({
    width: 780, height: 660, minWidth: 600, minHeight: 580,
    show: process.env.ALGOARENA_HEADLESS !== "1",
    title: "AlgoArena", autoHideMenuBar: true,
    backgroundColor: "#0b1220", icon: path.join(__dirname, "assets", "icon.ico"),
    webPreferences: { preload: path.join(__dirname, "launcher-preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const fromLauncher = event => !launcher.isDestroyed() && event.sender === launcher.webContents && event.senderFrame === launcher.webContents.mainFrame;
  let launching = false;
  ipcMain.handle("launcher:language", (event, value) => {
    if (!fromLauncher(event)) throw Error("Unauthorized");
    if (value !== undefined) saveLanguage(value);
    return language;
  });
  ipcMain.handle("studio:language", (event, value) => {
    if (event.senderFrame !== event.sender.mainFrame || new URL(event.sender.getURL()).origin !== buildBackendUrl()) throw Error("Unauthorized");
    saveLanguage(value);
  });
  ipcMain.handle("launcher:launch", async (event, target) => {
    if (!fromLauncher(event) || !["web", "desktop"].includes(target)) throw Error("Unauthorized");
    if (launching) throw Error(text("Démarrage déjà en cours", "Already starting"));
    launching = true;
    try {
      await launchStudio(target);
      if (!quitting && !launcher.isDestroyed()) launcher.destroy();
    } catch (error) {
      if (!activeTarget) { tray?.destroy(); tray = null; await stopBackend(); }
      throw error;
    } finally { launching = false; }
  });
  ipcMain.handle("launcher:quit", event => { if (fromLauncher(event)) app.quit(); });
  launcher.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  launcher.webContents.on("will-navigate", event => event.preventDefault());
  launcher.loadFile(path.join(__dirname, "launcher.html"));
  launcher.on("closed", () => { if (!activeTarget) app.quit(); });
});

app.on("window-all-closed", () => {
  if (activeTarget !== "web") app.quit();
});

app.on("before-quit", async (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  tray?.destroy();
  tray = null;
  await stopBackend();
  app.quit();
});
