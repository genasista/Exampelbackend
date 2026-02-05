/**
 * Azure Blob Storage provider (production path).
 *
 * Responsibilities:
 * - Save original artifacts to an Azure Blob container (private by default).
 * - Generate short-lived read URLs using SAS (Shared Access Signature).
 * - Stay behind a clean `StorageProvider` interface so swapping providers is trivial.
 *
 * Env vars:
 * - AZURE_STORAGE_CONNECTION_STRING (required when STORAGE_PROVIDER=azure)
 * - AZURE_STORAGE_CONTAINER (optional, default: "artifacts")
 * - AZURE_STORAGE_ACCOUNT / AZURE_STORAGE_KEY (optional overrides for SAS)
 *
 * Notes:
 * - We compute and store a sha256 for idempotence/traceability.
 * - We attach `blobContentType` for better downloads in browsers.
 * - Container is created on first use if it doesn’t exist (private ACL).
 */

import path from "path";
import crypto from "crypto";
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import type { StorageProvider, SavedObject, ReadLocator } from "../types/storage";

/** Hex SHA-256 helper for integrity and de-duplication signals. */
function sha256Hex(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/** Best-effort content type from file extension (improves UX on download). */
function guessContentTypeFromExt(ext: string): string | undefined {
  switch ((ext || "").toLowerCase()) {
    case ".pdf":  return "application/pdf";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".png":  return "image/png";
    case ".txt":  return "text/plain; charset=utf-8";
    case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:      return undefined;
  }
}

/**
 * Pull accountName/accountKey out of a connection string if not provided separately.
 * This enables SAS signing without requiring extra env vars.
 */
function parseFromConnectionString(cs: string | undefined) {
  if (!cs) {return { accountName: undefined as string | undefined, accountKey: undefined as string | undefined };}
  const map = Object.fromEntries(
    cs.split(";").filter(Boolean).map(kv => {
      const [k, ...rest] = kv.split("=");
      return [k.trim().toLowerCase(), rest.join("=").trim()];
    })
  );
  return {
    accountName: map["accountname"],
    accountKey: map["accountkey"],
  };
}

export class AzureBlobStorage implements StorageProvider {
  private service: BlobServiceClient;
  private containerName: string;
  private accountName?: string;
  private accountKey?: string;

  constructor() {
    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!conn) {throw new Error("AZURE_STORAGE_CONNECTION_STRING is required");}

    // Client bound to the account from the connection string
    this.service = BlobServiceClient.fromConnectionString(conn);
    this.containerName = process.env.AZURE_STORAGE_CONTAINER || "artifacts";

    // Optional overrides for SAS signing; else auto-parse from connection string
    const parsed = parseFromConnectionString(conn);
    this.accountName = process.env.AZURE_STORAGE_ACCOUNT || parsed.accountName;
    this.accountKey  = process.env.AZURE_STORAGE_KEY || parsed.accountKey;
  }

  /**
   * Lazily create the container if missing.
   * Default ACL is private (no anonymous access).
   */
  private async ensureContainer() {
    const c = this.service.getContainerClient(this.containerName);
    if (!(await c.exists())) {
      await c.create(); // private by default
    }
    return c;
  }

  /** Save original artifact; return metadata for DB persistence. */
  async saveOriginal(args: {
    buf: Buffer;
    grade?: string | null;  // optional folder hint
    assignmentId: string;
    submissionId: string;
    ext: string;            // ".pdf" | ".png" | ".docx" | ".txt"
  }): Promise<SavedObject> {
    const { buf, grade, assignmentId, submissionId } = args;

    // Normalize extension and produce a portable, POSIX-style blob path.
    const ext = args.ext.startsWith(".") ? args.ext : `.${args.ext}`;
    const storagePath = path.posix.join(
      grade ? grade : "class",       // groups by grade if provided, else "class"
      assignmentId,
      submissionId,
      `original${ext.toLowerCase()}`
    );

    const hash = sha256Hex(buf);
    const container = await this.ensureContainer();
    const blob = container.getBlockBlobClient(storagePath);

    await blob.uploadData(buf, {
      metadata: { sandbox: "true", sha256: hash }, // metadata is handy for audits
      blobHTTPHeaders: { blobContentType: guessContentTypeFromExt(ext) },
    });

    return {
      storagePath,
      absolutePath: "", // not meaningful on cloud provider
      sha256: hash,
      size: buf.length,
    };
  }

  /**
   * Produce a read locator for the saved object.
   * Preferred: a short-lived SAS URL (requires accountName/accountKey).
   * Fallback: bare blob URL (will 403 for private containers).
   */
  async getReadLocator(storagePath: string): Promise<ReadLocator> {
    // Try to create a short-lived SAS for secure downloads
    if (this.accountName && this.accountKey) {
      const cred = new StorageSharedKeyCredential(this.accountName, this.accountKey);
      // Small clock skew window + 10 minutes validity
      const startsOn = new Date(Date.now() - 60_000);
      const expiresOn = new Date(Date.now() + 10 * 60_000);

      const sas = generateBlobSASQueryParameters(
        {
          containerName: this.containerName,
          blobName: storagePath,
          permissions: BlobSASPermissions.parse("r"), // read-only
          startsOn,
          expiresOn,
        },
        cred
      ).toString();

      const baseUrl = this.service
        .getContainerClient(this.containerName)
        .getBlobClient(storagePath).url;

      return { kind: "url", url: `${baseUrl}?${sas}` };
    }

    // Fallback: non-SAS URL (useful in dev; private containers will 403)
    const url = this.service.getContainerClient(this.containerName)
      .getBlobClient(storagePath).url;
    return { kind: "url", url };
  }
}