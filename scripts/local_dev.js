const { spawn } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const localPython = isWindows
  ? path.join(root, ".venv", "Scripts", "python.exe")
  : path.join(root, ".venv", "bin", "python");
const fs = require("fs");
const pythonCommand = fs.existsSync(localPython) ? localPython : "python";

const children = [];

function killTree(pid) {
  if (!pid) return;
  if (isWindows) {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { shell: true, stdio: "ignore" });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch (_) {
    try {
      process.kill(pid, "SIGTERM");
    } catch (_) {
      // no-op
    }
  }
}

function run(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    shell: isWindows,
    stdio: ["inherit", "pipe", "pipe"],
    env: { ...process.env, PYTHONPATH: root }
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });
  children.push(child);
}

function stopAll() {
  for (const child of children) {
    if (!child.killed) {
      killTree(child.pid);
    }
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});
process.on("exit", stopAll);

console.log("Starting AlgoArena local dev stack...");
console.log("Backend:  http://localhost:8000");
console.log("Frontend: http://localhost:5173");
console.log("Press Ctrl+C to stop both processes.\n");

run("backend", pythonCommand, ["-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--ws", "wsproto"], root);
run("frontend", "npm", ["--prefix", "frontend", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"], root);
