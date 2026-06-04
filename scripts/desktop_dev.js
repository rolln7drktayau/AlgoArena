const { spawn } = require("child_process");
const electronPath = require("electron");

const args = process.argv.slice(2);
const electronArgs = args.length > 0 ? args : ["."];
const env = { ...process.env };

delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_NO_ATTACH_CONSOLE;

const child = spawn(electronPath, electronArgs, {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  windowsHide: false
});

child.on("error", (error) => {
  console.error(`Unable to start Electron: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
