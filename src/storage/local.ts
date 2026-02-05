// !!!!!!!!!!!! FOR DEV / TESTING ONLY !!!!!!!!!!!!
// This is a simple local filesystem storage provider.
// Do NOT use in production, as it does not scale and has no redundancy or safety!
// For production use azure.ts instead (Azure Blob Storage).

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { ReadLocator, SavedObject, StorageProvider } from "../types/storage";


/** Small helper: ensure `p` stays inside `root` */
function safeJoin(root: string, ...parts: string[]): string {
  const resolved = path.resolve(root, ...parts);
  const normalizedRoot = path.resolve(root);
  if (!resolved.startsWith(normalizedRoot + path.sep)) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

/** Normalize for DB: always POSIX slashes regardless of OS. */
function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Local filesystem storage (dev only).
 * Layout: ./artifacts/class/<assignmentId>/<submissionId>/original<ext>
 */
export class LocalFsStorage implements StorageProvider {
  constructor(private root = path.resolve(process.cwd(), "artifacts")) {}

  async saveOriginal(args: {
    buf: Buffer;
    grade?: string | null;  // optional input
    assignmentId: string;
    submissionId: string;
    ext: string;
  }): Promise<SavedObject> {
    const { buf, grade, assignmentId, submissionId } = args;

    // Basic ext hygiene: enforce leading dot and a safe whitelist-ish pattern
    const ext = args.ext.startsWith(".") ? args.ext : `.${args.ext}`;
    if (!/^\.[a-z0-9]+$/i.test(ext)) {
      throw new Error(`Invalid file extension: ${ext}`);
    }

    // Hash for metadata
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

    // Logical relative path (POSIX for DB)
    const relDirPosix = toPosix(
      path.posix.join(
        grade ? grade : "class",
        assignmentId,
        submissionId
      )
    );
    const fileName = `original${ext.toLowerCase()}`;
    const storagePath = toPosix(path.posix.join(relDirPosix, fileName));

    // Actual disk paths (guarded)
    const absDir = safeJoin(this.root, ...storagePath.split("/").slice(0, -1));
    const absolutePath = safeJoin(this.root, storagePath);

    await fs.promises.mkdir(absDir, { recursive: true });
    await fs.promises.writeFile(absolutePath, buf);

    return {
      storagePath,            // POSIX path for DB
      absolutePath,           // local-only convenience
      sha256,
      size: buf.length,
    };
  }

  async getReadLocator(storagePath: string): Promise<ReadLocator> {
    // Resolve safely inside root
    const absolutePath = safeJoin(this.root, ...toPosix(storagePath).split("/"));
    return { kind: "local", absolutePath };
  }
}
