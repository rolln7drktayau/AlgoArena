const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

let backendProcess = null;

function resolveAppRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, "app") : path.resolve(__dirname, "..");
}

function resolvePythonCommand(appRoot) {
  const envPath = process.env.ALGOARENA_PYTHON;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const venvPython = path.join(appRoot, ".venv", "Scripts", "python.exe");
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }

  return process.platform === "win32" ? "python" : "python3";
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

async function waitForBackendReady(timeoutMs = 20000) {
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

function startBackend() {
  const appRoot = resolveAppRoot();
  const pythonCmd = resolvePythonCommand(appRoot);

  backendProcess = spawn(
    pythonCmd,
    ["-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    {
      cwd: appRoot,
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        PYTHONPATH: appRoot
      }
    }
  );

  backendProcess.on("error", async (error) => {
    await dialog.showMessageBox({
      type: "error",
      title: "AlgoArena Desktop",
      message: "Unable to start backend service.",
      detail:
        `${String(error)}\n\n` +
        "Checks:\n" +
        "- Python installed\n" +
        "- backend deps installed in .venv\n" +
        "- frontend/dist built\n" +
        "- Optionally set ALGOARENA_PYTHON to a valid python.exe path"
    });
  });
}

function stopBackend() {
  if (!backendProcess) return;
  try {
    backendProcess.kill();
  } catch (_) {
    // noop
  }
  backendProcess = null;
}

function createWindow() {
  const appRoot = resolveAppRoot();
  const iconPath = path.join(appRoot, "frontend", "dist", "logo.png");

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
  win.loadURL("http://127.0.0.1:8000");
}

app.whenReady().then(async () => {
  startBackend();
  const ready = await waitForBackendReady();

  if (!ready) {
    await dialog.showMessageBox({
      type: "error",
      title: "AlgoArena Desktop",
      message: "Backend did not become ready on http://127.0.0.1:8000.",
      detail:
        "Run once in terminal to prepare environment:\n" +
        "powershell -ExecutionPolicy Bypass -File .\\scripts\\start_windows.ps1"
    });
    app.quit();
    return;
  }

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
});
