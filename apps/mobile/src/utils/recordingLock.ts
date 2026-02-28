/**
 * recordingLock — module-level promise-based lock for expo-av Recording.
 *
 * expo-av only allows ONE Recording object to be in the "prepared" state at a
 * time across the entire process.  When a screen unmounts it fires
 * stopAndUnloadAsync() asynchronously (fire-and-forget in cleanup).  If the
 * next screen's startListen() begins before that async unload resolves, both
 * calls overlap and the second one throws:
 *
 *   "Only one Recording object can be prepared at a given time"
 *
 * This module solves the problem by:
 *  1. `lockForUnload(fn)` — call when starting stopAndUnloadAsync; the lock
 *     tracks the promise so future callers can wait for it.
 *  2. `waitForUnlock()` — call before Audio.Recording.createAsync; awaits any
 *     in-flight unload before proceeding.
 *
 * Both useVoiceSession and useVideoSession share this module, so rapid
 * Voice → Video → Voice navigation is safe.
 */

let _pendingUnload: Promise<void> | null = null

/**
 * Register an in-flight stopAndUnloadAsync call.
 * The lock is automatically released when `fn` resolves or rejects.
 */
export function lockForUnload(fn: () => Promise<void>): void {
  _pendingUnload = fn().finally(() => {
    _pendingUnload = null
  })
}

/**
 * Await any in-flight unload before trying to createAsync.
 * If there is no pending unload, resolves immediately.
 */
export async function waitForUnlock(): Promise<void> {
  if (_pendingUnload) await _pendingUnload
}
