/**
 * Lightweight analytics event logger.
 *
 * Currently outputs structured console.log lines visible via:
 *   adb logcat -s ReactNativeJS:V | grep "\[Analytics\]"
 *
 * Future: swap the body of `logEvent` to call Amplitude / Firebase /
 * Meta SDK — the call sites throughout the app stay unchanged.
 */

type EventProps = Record<string, string | number | boolean | null | undefined>

export function logEvent(name: string, props?: EventProps): void {
  try {
    const line = props && Object.keys(props).length > 0
      ? `[Analytics] ${name} ${JSON.stringify(props)}`
      : `[Analytics] ${name}`
    console.log(line)
  } catch {
    // never crash the app over analytics
  }
}
