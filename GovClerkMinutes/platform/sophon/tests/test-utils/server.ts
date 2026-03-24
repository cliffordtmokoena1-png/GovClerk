import { spawn } from "child_process";

let built = false;

export async function buildServer() {
  if (built || process.env.FORCE_NO_BUILD) {
    return; // cache build across suites
  }
  console.info("Building server from:", process.cwd());

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("npm", ["run", "build"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });

    proc.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error("Build failed"));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });

  built = true;
}

export function startServer(port: number, env: Record<string, string> = {}) {
  return spawn("node", ["dist/index.js"], {
    env: { ...process.env, PORT: String(port), NODE_ENV: "test", FORCE_SERVER_START: "1", ...env },
    stdio: "inherit",
  });
}

export async function waitForHealth(base: string, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) {
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Server did not become healthy within timeout");
}
