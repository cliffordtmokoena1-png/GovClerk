#!/usr/bin/env node

import { execSync } from "child_process";
import path from "path";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import readline from "readline";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config({ path: ".env" });

const RUNPOD_CONFIG_PATH = path.join(process.env.HOME!, ".runpod", "config.toml");

if (!fs.existsSync(RUNPOD_CONFIG_PATH)) {
  console.log("Config file not found at ~/.runpod/config.toml. Running runpodctl config...");
  try {
    const apiKey = process.env.RUNPOD_API_KEY!;
    execSync(`runpodctl config --apiKey ${apiKey}`, { stdio: "inherit" });
    console.log("Runpod config successfully set up.");
  } catch (error) {
    console.error("Error running runpodctl config:", error);
    process.exit(1);
  }
}

const argv = yargs(hideBin(process.argv))
  .option("restart", {
    type: "boolean",
    description: "Restart server after deployment",
    default: false,
  })
  .option("screen", {
    type: "boolean",
    description: "Attach to screen session after deployment",
    default: false,
  })
  .option("screen-only", {
    type: "boolean",
    description: "Skip deployment and only attach to screen session",
    default: false,
  })
  .option("key", {
    type: "string",
    description: "Path to SSH identity file",
    default: path.join(process.env.HOME!, ".ssh", "id_rsa"),
  })
  .option("pod", {
    type: "string",
    description: "ID of the pod to connect to",
  })
  .option("dev", {
    type: "boolean",
    description: "Enable development environment (sets RUST_ENV=development)",
    default: false,
  })
  .option("skip-commitcheck", {
    type: "boolean",
    description: "Skip checking if we're on the latest commit from GitHub",
    default: false,
  })
  .help("h")
  .alias("h", "help")
  .parseSync();

const RESTART_SERVER = argv.restart;
const ATTACH_SCREEN = argv.screen || argv["screen-only"];
const SKIP_DEPLOY = argv["screen-only"];
const SKIP_COMMITCHECK = argv["skip-commitcheck"];
const IDENTITY_FILE = argv.key;
const IS_DEV_ENV = argv.dev;

let POD_ID = argv.pod;
let SERVER = "";
let PORT = "";
const USER = "root";
const REPO_ROOT = execSync("git rev-parse --show-toplevel").toString().trim();
let SSH_OPTS;

const getAvailablePods = (): Pod[] => {
  console.log("Fetching available pods...");
  const podData = execSync("runpodctl get pod --allfields").toString();
  const lines = podData.split("\n").slice(1); // Skip headers
  const pods = lines
    .map((line: string) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return null;
      }

      const columns = trimmed.split(/\s{2,}|\t+/);
      if (columns.length < 12) {
        return null;
      }

      const [id, name] = columns;
      const portInfo = columns[columns.length - 1];

      const publicSSHInfo = portInfo.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)->22/);
      const serverIP = publicSSHInfo ? publicSSHInfo[1] : "";
      const serverPort = publicSSHInfo ? publicSSHInfo[2] : "";

      return { id: id.trim(), name: name.trim(), serverIP, serverPort };
    })
    .filter((pod: { id: string; name: string; serverIP: string; serverPort: string } | null) =>
      Boolean(pod)
    );
  return pods as Pod[];
};

type Pod = {
  id: string;
  name: string;
  serverIP: string;
  serverPort: string;
};

async function checkGitStatus() {
  console.log("🔍 Checking git status...");

  try {
    const status = execSync("git status --porcelain", { encoding: "utf8" }).trim();
    if (status) {
      console.log("Warning: You have uncommitted changes:");
      console.log(status);
      console.log("Consider committing your changes before deploying.");
    }

    const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
    console.log(`Current branch: ${currentBranch}`);

    if (currentBranch !== "main") {
      console.log("   Warning: You are not on the main branch.");
      console.log("   Consider deploying from the main branch.");
    }

    const currentCommit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    console.log(`Current commit: ${currentCommit.substring(0, 8)}`);

    console.log("Fetching latest from origin...");
    execSync("git fetch origin", { stdio: "inherit" });

    const remoteCommit = execSync(`git rev-parse origin/${currentBranch}`, {
      encoding: "utf8",
    }).trim();
    console.log(`Remote commit: ${remoteCommit.substring(0, 8)}`);

    if (currentCommit !== remoteCommit) {
      console.log("Your local branch is not up to date with the remote branch!");
      console.log(`   Local:  ${currentCommit.substring(0, 8)}`);
      console.log(`   Remote: ${remoteCommit.substring(0, 8)}`);

      try {
        const aheadBehind = execSync(
          `git rev-list --left-right --count ${currentCommit}...${remoteCommit}`,
          { encoding: "utf8" }
        ).trim();
        const [ahead, behind] = aheadBehind.split("\t").map(Number);

        if (ahead > 0 && behind > 0) {
          console.log(`   You are ${ahead} commits ahead and ${behind} commits behind the remote.`);
          console.log("   Consider rebasing or merging with the remote branch.");
        } else if (ahead > 0) {
          console.log(`   You are ${ahead} commits ahead of the remote.`);
          console.log("   Consider pushing your changes first.");
        } else if (behind > 0) {
          console.log(`   You are ${behind} commits behind the remote.`);
          console.log("   Consider pulling the latest changes first.");
        }
      } catch (error) {
        console.log("   Could not determine ahead/behind status.");
      }

      console.log("\nTo skip this check, use: npm run deploy:server -- --skip-commitcheck");
      process.exit(1);
    }

    console.log("Your branch is up to date with the remote!");
  } catch (error) {
    console.error("Error checking git status:", error);
    process.exit(1);
  }
}

async function promptUserForPod(pods: Array<Pod>): Promise<Pod> {
  console.log("\nAvailable Pods:");
  pods.forEach((pod: Pod, index: number) => {
    console.log(`${index + 1}) ${pod.name} (ID: ${pod.id})`);
    console.log(`   SSH Command: ssh root@${pod.serverIP} -p ${pod.serverPort}`);
  });

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("\nSelect a pod by number: ", (answer: string) => {
      const index = parseInt(answer, 10) - 1;
      if (index >= 0 && index < pods.length) {
        rl.close();
        resolve(pods[index]);
      } else {
        console.error("Invalid selection, please try again.");
        rl.close();
        process.exit(1);
      }
    });
  });
}

const main = async () => {
  if (!SKIP_COMMITCHECK) {
    await checkGitStatus();
  } else {
    console.log("Skipping git commit check as requested.");
  }

  if (!POD_ID) {
    const pods = getAvailablePods();
    if (pods.length === 0) {
      console.error("No available pods found.");
      process.exit(1);
    }
    const selectedPod = await promptUserForPod(pods);
    POD_ID = selectedPod.id;
    SERVER = selectedPod.serverIP;
    PORT = selectedPod.serverPort;
  } else {
    const pods = getAvailablePods();
    const selectedPod = pods.find((pod: Pod) => pod.id === POD_ID);
    if (!selectedPod) {
      console.error(`Pod with ID ${POD_ID} not found.`);
      process.exit(1);
    }
    SERVER = selectedPod.serverIP;
    PORT = selectedPod.serverPort;
  }

  SSH_OPTS = `-i ${IDENTITY_FILE} -p ${PORT}`;

  if (!SKIP_DEPLOY) {
    console.log("Deploying supporting files...");
    execSync(`ssh ${SSH_OPTS} ${USER}@${SERVER} 'mkdir -p ~/server'`, {
      stdio: "inherit",
    });

    execSync(`rsync -v -e "ssh ${SSH_OPTS}" ${REPO_ROOT}/.env ${USER}@${SERVER}:~/server/.env`, {
      stdio: "inherit",
    });

    execSync(
      [
        `rsync -av --no-o --no-g -e "ssh ${SSH_OPTS}"`,
        "--exclude '.cached_test_assets/'",
        "--exclude 'target/'",
        "platform/server/",
        `${REPO_ROOT}/Cargo.lock`,
        `${REPO_ROOT}/rust-toolchain.toml`,
        `${REPO_ROOT}/.cargo`,
        `${USER}@${SERVER}:~/server/`, // Destination
      ].join(" "),
      { stdio: "inherit" }
    );

    execSync(
      [
        `ssh ${SSH_OPTS} ${USER}@${SERVER}`,
        "mv",
        "/root/server/.cargo/linux-config.toml",
        "/root/server/.cargo/config.toml",
      ].join(" "),
      {
        stdio: "inherit",
      }
    );

    if (RESTART_SERVER) {
      console.log("Restarting server...");
      const envCommand = IS_DEV_ENV ? "export RUST_ENV=development && " : "";
      execSync(
        `ssh ${SSH_OPTS} ${USER}@${SERVER} /bin/bash <<'EOF'
SCREEN_ID=$(screen -ls | awk '/\t[0-9]+\\./ {print $1}' | head -1)
if [ -n "$SCREEN_ID" ]; then
    screen -S "$SCREEN_ID" -X stuff "$(printf '\\003')"
    sleep 1
    screen -S "$SCREEN_ID" -X stuff "${envCommand}cd ~/server && cargo run --release -- --port 8888$(printf '\n')"
else
    echo "No screen session found, starting screen session..."
    screen -dmS server ${envCommand}cd ~/server && cargo run --release -- --port 8888
fi
EOF`,
        { stdio: "inherit" }
      );
      console.log("Server restarted automatically.");
    } else {
      console.log("Server restart skipped (use --restart to restart server).");
    }

    console.log("Deployment complete.");
  }

  if (ATTACH_SCREEN) {
    console.log("Connecting to screen session...");
    execSync(
      `ssh ${SSH_OPTS} -t ${USER}@${SERVER} /bin/bash <<'EOF'
SCREEN_ID=$(screen -ls | awk '/\t[0-9]+\\./ {print $1}' | head -1)
if [ -n "$SCREEN_ID" ]; then
    exec screen -r "$SCREEN_ID"
else
    echo "No screen session found"
    exit 1
fi
EOF`,
      { stdio: "inherit" }
    );
  }
};

main();
