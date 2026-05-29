// Phase-85A: Durable Institutional Memory
// Server-only — uses supabaseAdmin for Supabase Storage persistence.
// Falls back silently to process-level if storage is unavailable.
//
// Persists to a private Supabase Storage bucket (genesis-memory):
//   genesis/v1/persistent-memory.json  — bounded PersistentMemoryEntry[]
//   genesis/v1/calibration-history.json — bounded CalibrationRecord[]
//
// No schema changes. No PII. No secrets in stored payloads.
// No broker data. No personal financial advice storage.
// All storage calls are fire-and-forget (non-blocking on main path).
//
// Graceful degradation: if SUPABASE_SERVICE_ROLE_KEY is absent or the bucket
// is inaccessible, the system works exactly as Phase-84B (process-level only)
// and logs a single warning.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  importMemoryState,
  exportMemoryState,
  type MemoryExport,
} from "./persistentMemoryStore";
import {
  loadCalibrationHistory,
  getCalibrationHistorySnapshot,
  type CalibrationRecord,
} from "./adaptiveCalibrationEngine";
import { applyLifecycleGovernance } from "./memoryLifecycleGovernor";
import { runArabicValidation } from "./arabicSemanticReasoningEngine";

// ─── Storage configuration ─────────────────────────────────────────────────────

const BUCKET_NAME = "genesis-memory";
const MEMORY_PATH  = "genesis/v1/persistent-memory.json";
const CALIBRATION_PATH = "genesis/v1/calibration-history.json";

// ─── Status tracking ──────────────────────────────────────────────────────────

type StorageStatus = "untested" | "available" | "unavailable";
let _storageStatus: StorageStatus = "untested";
let _loadedOnce = false;
let _loadAttemptedAt = 0;
const RELOAD_COOLDOWN_MS = 10 * 60 * 1000; // don't retry load more often than 10 min

// ─── Safe storage helpers ─────────────────────────────────────────────────────

async function ensureBucket(): Promise<boolean> {
  try {
    // Try to create the bucket — idempotent (existing bucket returns error we ignore)
    await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: 512 * 1024, // 512 KB max per file
    });
    return true;
  } catch {
    // May already exist — that's fine
    return true;
  }
}

async function storageUpload(path: string, payload: unknown): Promise<boolean> {
  try {
    const body = JSON.stringify(payload);
    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(path, body, {
        contentType: "application/json",
        upsert: true,
      });
    if (error) {
      console.warn(`[durable-memory] upload failed path=${path}: ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[durable-memory] upload exception path=${path}: ${msg}`);
    return false;
  }
}

async function storageDownload<T>(path: string): Promise<T | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .download(path);
    if (error || !data) return null;
    const text = await data.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Lazily loads durable memory from Supabase Storage into process stores.
 * Called once per process lifetime on the first investment call.
 * Non-blocking on main path — awaited before prompt construction only.
 * Safe to call multiple times (no-ops after first load).
 */
export async function loadDurableMemory(): Promise<void> {
  const now = Date.now();
  if (_loadedOnce && now - _loadAttemptedAt < RELOAD_COOLDOWN_MS) return;
  _loadAttemptedAt = now;
  _loadedOnce = true;

  // Phase-85A: Run Arabic semantic validation on each fresh load (diagnostic only)
  const validation = runArabicValidation();
  console.log(`[arabic-semantic] validation: passed=${validation.passed}/${validation.passed + validation.failed}`);
  if (validation.failed > 0) {
    const failures = validation.cases.filter(c => !c.passed).map(c => c.id).join(",");
    console.warn(`[arabic-semantic] failed cases: ${failures}`);
  }

  if (_storageStatus === "unavailable") return;

  try {
    await ensureBucket();

    // Load persistent memory entries
    const memExport = await storageDownload<MemoryExport>(MEMORY_PATH);
    if (memExport?.entries?.length) {
      const imported = importMemoryState(memExport);
      console.log(`[durable-memory] loaded persistent memory: ${imported} entries`);
    }

    // Load calibration history
    const calibData = await storageDownload<{ records: CalibrationRecord[] }>(CALIBRATION_PATH);
    if (calibData?.records?.length) {
      const loaded = loadCalibrationHistory(calibData.records);
      console.log(`[durable-memory] loaded calibration history: ${loaded} records`);
    }

    _storageStatus = "available";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Log once; don't flood logs on every investment call
    if (_storageStatus !== "unavailable") {
      console.warn(`[durable-memory] storage unavailable, using process-level only: ${msg}`);
    }
    _storageStatus = "unavailable";
  }
}

/**
 * Fire-and-forget save of current memory state to Supabase Storage.
 * Called in Step 4 of the genesis pipeline after snapshot is saved.
 * Never awaited on main path — errors are logged, not thrown.
 */
export function saveDurableMemoryBackground(): void {
  if (_storageStatus === "unavailable") return;
  // Run async without awaiting
  _saveDurableMemory().catch(err => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[durable-memory] background save failed: ${msg}`);
    _storageStatus = "unavailable";
  });
}

async function _saveDurableMemory(): Promise<void> {
  // Apply lifecycle governance before persisting to keep storage clean
  const rawExport = exportMemoryState();
  const { entries: governed, report } = applyLifecycleGovernance(rawExport.entries);
  if (report.expired + report.contradictions + report.duplicates > 0) {
    console.log(`[durable-memory] lifecycle governance: removed exp=${report.expired} contra=${report.contradictions} dup=${report.duplicates}`);
  }

  const cleanExport: MemoryExport = { ...rawExport, entries: governed };
  const calibSnapshot = getCalibrationHistorySnapshot();

  await ensureBucket();

  const [memOk, calibOk] = await Promise.all([
    storageUpload(MEMORY_PATH, cleanExport),
    calibSnapshot.length > 0
      ? storageUpload(CALIBRATION_PATH, { records: calibSnapshot, savedAt: Date.now() })
      : Promise.resolve(true),
  ]);

  if (memOk || calibOk) {
    _storageStatus = "available";
    console.log(`[durable-memory] saved: memory=${memOk ? "ok" : "failed"} calibration=${calibOk ? "ok" : "failed"} entries=${governed.length} calibRecords=${calibSnapshot.length}`);
  }
}

/**
 * Returns current storage availability for diagnostic logging.
 */
export function getDurableStorageStatus(): StorageStatus {
  return _storageStatus;
}
