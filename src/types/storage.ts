/**
 * Storage abstraction contracts, shared by all storage providers.
 *
 * - Keep these types small and stable so providers (Local/Azure/…)
 *   can be swapped without touching business logic.
 * - This is not part of the public OpenAPI schema; it’s internal server shape.
 */

/**
 * What we persist about the saved original.
 * - storagePath: logical, POSIX-style path you store in DB (portable)
 * - absolutePath: local absolute path (dev only; not for Azure prod)
 */
export type SavedObject = {
  storagePath: string;
  absolutePath: string;
  sha256: string;
  size: number;
};

/** Discriminated union for read locators (local file vs time-limited URL). */
export type ReadLocator =
  | { kind: "local"; absolutePath: string }
  | { kind: "url"; url: string };

/**
 * Provider interface implemented by LocalFsStorage, AzureBlobStorage, etc.
 * Business logic depends only on this interface.
 */
export interface StorageProvider {
  saveOriginal(args: {
    buf: Buffer;
    grade?: string | null;     // optional input (for grouping paths)
    assignmentId: string;
    submissionId: string;
    ext: string; // ".pdf", ".png", ".docx", ".txt" — include the dot
  }): Promise<SavedObject>;

  /** Returns how to read the original (local path in dev, SAS URL in Azure). */
  getReadLocator(storagePath: string): Promise<ReadLocator>;
}