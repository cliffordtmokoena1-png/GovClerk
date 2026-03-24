import { FlateError, zip, unzip } from "fflate";

type ZipOptions = {
  // Compression level, default is 2
  level?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  // Optional output file name, default is "files.zip"
  outputName?: string;
};
export async function zipFiles(files: File[], options?: ZipOptions): Promise<File> {
  const level = options?.level ?? 2;
  const outputName = options?.outputName || "files.zip";

  const input: Record<string, Uint8Array> = {};
  await Promise.all(
    files.map(async (file) => {
      input[file.name] = new Uint8Array(await file.arrayBuffer());
    })
  );

  return new Promise<File>((resolve, reject) => {
    zip(input, { level }, (err: FlateError | null, data: Uint8Array) => {
      if (err) {
        return reject(err);
      }
      resolve(new File([new Uint8Array(data)], outputName, { type: "application/zip" }));
    });
  });
}

export async function unzipFiles(zip: File | ArrayBufferLike): Promise<File[]> {
  const data = zip instanceof File ? await zip.bytes() : new Uint8Array(zip);
  return new Promise<File[]>((resolve, reject) => {
    unzip(data, (err: FlateError | null, files: Record<string, Uint8Array>) => {
      if (err) {
        return reject(err);
      }
      const result = Object.entries(files).map(
        ([name, content]) => new File([new Uint8Array(content)], name)
      );
      resolve(result);
    });
  });
}

export async function isZip(file: File | ArrayBufferLike): Promise<boolean> {
  const buffer = file instanceof File ? await file.arrayBuffer() : file;
  const header = new Uint8Array(buffer.slice(0, 4));
  return header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04;
}
