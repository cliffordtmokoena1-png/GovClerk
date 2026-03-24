import fs from "fs";
import path from "path";

// Walk up directories starting from the current working directory.
// Search each directory for a .env file.
// If found return the path, else return null.
export function findDotEnvPath(): string | null {
  let currentDir = process.cwd();

  while (true) {
    const envPath = path.join(currentDir, ".env");
    if (fs.existsSync(envPath)) {
      return envPath;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

export function findAllDotEnvPaths(): string[] {
  const paths: string[] = [];
  let currentDir = process.cwd();

  while (true) {
    const envPath = path.join(currentDir, ".env");
    if (fs.existsSync(envPath)) {
      paths.push(envPath);
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return paths.reverse();
}
