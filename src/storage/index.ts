/**
 * Storage provider selector + singleton.
 *
 * - Chooses between Local FS (dev) and Azure Blob (prod) based on env.
 * - Exposes a single instance for the process (cheaper clients, fewer connections).
 * - Export `getStorageProviderName()` for diagnostics (/health, logs).
 *
 * Env:
 * - STORAGE_PROVIDER = "local" | "azure"  (default: "local")
 * - AZURE_STORAGE_CONNECTION_STRING      (required when azure)
 */

import 'dotenv/config';
import { LocalFsStorage } from './local';
import { AzureBlobStorage } from './azure';
import type { StorageProvider } from '../types/storage';

let singleton: StorageProvider | null = null;
let providerName: 'azure' | 'local' = 'local';

export function getStorage(): StorageProvider {
  if (singleton) return singleton;

  // Decide provider from env (default to local for easy dev)
  const mode = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

  if (mode === 'azure') {
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
      throw new Error(
        'STORAGE_PROVIDER=azure but AZURE_STORAGE_CONNECTION_STRING is missing. ' +
        'Set it in .env and restart the server.'
      );
    }
    singleton = new AzureBlobStorage();
    providerName = 'azure';
  } else {
    // Local FS provider (writes under ./artifacts)
    singleton = new LocalFsStorage();
    providerName = 'local';
  }

  return singleton;
}

/** Handy for /health or logs to see which backend we’re using. */
export function getStorageProviderName() {
  return providerName;
}