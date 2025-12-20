import fs from "fs"

const p = "components/voice-call-dialog.tsx"
let s = fs.readFileSync(p, "utf8")

function pickChunksRefName(src) {
  const refs = []
  const re = /const\s+([A-Za-z_$][\w$]*)\s*=\s*useRef<[^>]*\[\][^>]*>\(\s*\[\]\s*\)/g
  let m
  while ((m = re.exec(src))) refs.push(m[1])

  // fallback: иногда тип не [] в generic, но init = []
  if (!refs.length) {
    const re2 = /const\s+([A-Za-z_$][\w$]*)\s*=\s*useRef<[^>]*>\(\s*\[\]\s*\)/g
    while ((m = re2.exec(src))) refs.push(m[1])
  }

  if (!refs.length) return null

  const score = (name) => {
    const n = name.toLowerCase()
    let sc = 0
    if (n.includes("chunk")) sc += 100
    if (n.includes("blob")) sc += 60
    if (n.includes("audio")) sc += 20
    if (n.includes("record")) sc += 10
    return sc
  }

  refs.sort((a,b) => score(b)-score(a))
  return refs[0]
}

function removeExisting(src) {
  const tags = ["ANDROID_ONE_SHOT_V3", "ANDROID_ONE_SHOT_V4"]
  let out = src
  for (const tag of tags) {
    const i = out.indexOf(`// ${tag}`)
    if (i < 0) continue
    const endMark = "}, [isCallActive, isMicMuted])"
    const j = out.indexOf(endMark, i)
    if (j < 0) {
      console.log(`WARN: нашёл ${tag}, но не нашёл конец блока, пропускаю удаление`)
      continue
    }
    const j2 = out.indexOf("\n", j + endMark.length)
    out = out.slice(0, i) + out.slice(j2 > 0 ? j2 + 1 : j + endMark.length)
  }
  return out
}

// удаляем старый блок (если был)
s = removeExisting(s)

// находим куда вставить — перед первым return(
const compStart =
  s.search(/export\s+default\s+function\s+VoiceCallDialog\b/) >= 0
    ? s.search(/export\s+default\s+function\s+VoiceCallDialog\b/)
    : s.search(/function\s+VoiceCallDialog\b/)

if (compStart < 0) {
  console.error("PATCH FAILED: не нашёл начало компонента VoiceCallDialog")
  process.exit(1)
}

const after = s.slice(compStart)
const reReturn = /\n\s*return\s*\(\s*\n/g
const mm = reReturn.exec(after)
let insertAt = -1
if (mm && typeof mm.index === "number") insertAt = compStart + mm.index
if (insertAt < 0) insertAt = s.lastIndexOf("\n  return (")

if (insertAt < 0) {
  console.error("PATCH FAILED: не нашёл `return (` для вставки")
  process.exit(1)
}

const chunksRefName = pickChunksRefName(s)
console.log("Detected chunks ref:", chunksRefName || "(none)")

const chunksLenLine = chunksRefName
  ? `        const chunksLen = (${chunksRefName} as any)?.current?.length`
  : `        const chunksLen = null`

const block = `

  // ANDROID_ONE_SHOT_V4: server logs + watchdog (только мобилки). Логи в терминал через /api/client-log при ?serverLog=1
  function __serverLog(event: string, data: any = {}) {
    try {
      if (typeof window === "undefined") return
      const sp = new URLSearchParams(window.location.search)
      if (!sp.has("serverLog")) return
      fetch("/api/client-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true as any,
        body: JSON.stringify({
          t: Date.now(),
          href: window.location.href,
          ua: navigator.userAgent,
          event,
          data,
        }),
      }).catch(() => {})
    } catch {}
  }

  useEffect(() => {
    if (!isCallActive) return

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua)
    if (!isMobile) return

    let tick = 0
    const id = window.setInterval(() => {
      try {
        if (!isCallActiveRef.current) return

        const rec: any = mediaRecorderRef.current
        const state = rec?.state || "null"

${chunksLenLine}
        const sentIdx = (sentIdxRef as any)?.current
        const sttBusy = (isSttBusyRef as any)?.current
        const micMuted = (isMicMutedRef as any)?.current

        tick++

        // периодически шлём состояние в терминал
        if (tick % 3 === 0) {
          __serverLog("mobile_state", { state, chunksLen, sentIdx, sttBusy, micMuted })
        }

        // если чанки обнулились, а sentIdx остался большим — сбрасываем
        if (typeof chunksLen === "number" && typeof sentIdx === "number" && sentIdx > chunksLen) {
          try { (sentIdxRef as any).current = 0 } catch {}
          try { (lastTranscriptRef as any).current = "" } catch {}
          __serverLog("sentIdx_reset", { sentIdx, chunksLen })
        }

        // если запись идёт — иногда Android не отдаёт чанки, принудительно просим data
        if (!micMuted && rec && state === "recording" && tick % 2 === 0) {
          try { rec.requestData?.() } catch {}
        }

        // если рекордер подвис — оживляем
        if (!micMuted && rec) {
          if (state === "paused") {
            try { rec.resume() } catch {}
            __serverLog("rec_resume_try", { state })
          } else if (state === "inactive") {
            try { rec.start(250) } catch {}
            try { (sentIdxRef as any).current = 0 } catch {}
            try { (lastTranscriptRef as any).current = "" } catch {}
            __serverLog("rec_restart_try", { state })
          }
        }
      } catch {}
    }, 900)

    return () => window.clearInterval(id)
  }, [isCallActive, isMicMuted])

`

s = s.slice(0, insertAt) + block + s.slice(insertAt)

fs.writeFileSync(p, s, "utf8")
console.log("OK patched:", p)
