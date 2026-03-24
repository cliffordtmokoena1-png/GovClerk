import { spawn } from "child_process";
import path from "path";

type ConvertDocumentParams = {
  input: Blob;
  inputType: string;
  outputType: string;
};

export async function convertDocument({
  input,
  inputType,
  outputType,
}: ConvertDocumentParams): Promise<Blob> {
  const buffer = await input.arrayBuffer();
  const inputBytes = new Uint8Array(buffer);

  return await new Promise<Blob>((resolve, reject) => {
    const child = spawn("pandoc", [
      "-f",
      inputType,
      "-t",
      outputType,
      "--reference-doc",
      path.join(__dirname, "../../..", "platform/server/assets", "pandoc-reference.docx"),
    ]);
    let stderr = "";
    const chunks: Buffer[] = [];
    child.on("error", reject);
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.on("close", (code) => {
      if (code === 0) {
        const outputBuffer = Buffer.concat(chunks);
        resolve(new Blob([outputBuffer]));
      } else {
        reject(new Error(`pandoc exited with code ${code}: ${stderr}`));
      }
    });
    child.stdin.write(inputBytes);
    child.stdin.end();
  });
}
