const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const http = require("http");

let backendProcess = null;
let backendLogPath = null;

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
    if (parsed.hostname !== "127.0.0.1" || parsed.port !== "8000") {
      return false;
    }
    return /^\/api\/runs\/[^/]+\/export\/(csv|pdf)$/.test(parsed.pathname);
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
  const runtimePython = resolveRuntimeVenvPython(runtimeRoot);
  const requirementsPath = path.join(appRoot, "backend", "requirements.txt");
  const requirementsHash = hashFileSha256(requirementsPath);
  const stampPath = path.join(runtimeRoot, "requirements.sha256");

  await runCommand(bootstrapPython, ["--version"], { cwd: appRoot }).catch(() => {
    throw new Error(
      "Python introuvable. Installe Python 3.11+ ou definis ALGOARENA_PYTHON vers python.exe."
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

function checkBackendHealth(timeoutMs = 1200) {
  return new Promise((resolve) => {
    const request = http.get("http://127.0.0.1:8000/api/health", (response) => {
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

async function waitForBackendReady(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const healthy = await checkBackendHealth();
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

function startBackend(appRoot, runtime) {
  backendLogPath = path.join(runtime.runtimeRoot, "backend.log");
  fs.writeFileSync(backendLogPath, "", "utf8");
  const logStream = fs.createWriteStream(backendLogPath, { flags: "a" });

  backendProcess = spawn(
    runtime.runtimePython,
    ["-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    {
      cwd: appRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONPATH: appRoot,
        ALGOARENA_RUNTIME_ROOT: runtime.runtimeRoot
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
      message: "Impossible de demarrer le backend.",
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

function createWindow(appRoot, startupInfo = null) {
  const distLogo = path.join(appRoot, "frontend", "dist", "logo.png");
  const publicLogo = path.join(appRoot, "frontend", "public", "logo.png");
  const iconPath = fs.existsSync(distLogo) ? distLogo : publicLogo;

  const win = new BrowserWindow({
    width: 1480,
    height: 900,
    minWidth: 1120,
    minHeight: 700,
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
    if (url.startsWith("http://127.0.0.1:8000")) {
      return;
    }
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

  win.loadURL("http://127.0.0.1:8000");
}

app.whenReady().then(async () => {
  const appRoot = resolveAppRoot();

  let runtime;
  try {
    runtime = await ensureDesktopRuntime(appRoot);
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      title: "AlgoArena Desktop",
      message: "Preparation automatique echouee.",
      detail: String(error)
    });
    app.quit();
    return;
  }

  startBackend(appRoot, runtime);
  const ready = await waitForBackendReady();

  if (!ready) {
    const logTail = tailFile(backendLogPath, 50);
    await dialog.showMessageBox({
      type: "error",
      title: "AlgoArena Desktop",
      message: "Backend did not become ready on http://127.0.0.1:8000.",
      detail:
        "AlgoArena a tente la preparation automatiquement.\n" +
        "Si le probleme persiste, lance une fois:\n" +
        "powershell -ExecutionPolicy Bypass -File .\\scripts\\start_windows.ps1\n\n" +
        (backendLogPath ? `Log: ${backendLogPath}\n\n` : "") +
        (logTail ? `Dernieres lignes:\n${logTail}` : "Aucun log backend disponible.")
    });
    await stopBackend();
    app.quit();
    return;
  }

  createWindow(appRoot, {
    title: "AlgoArena Desktop",
    message: "AlgoArena is ready.",
    localUrl: "http://127.0.0.1:8000",
    docsUrl: "http://127.0.0.1:8000/docs",
    note: "Close this message to open the desktop window."
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  await stopBackend();
});
