export const runtime = "nodejs"

export async function POST(req: Request) {
  let body: any = null
  try {
    body = await req.json()
  } catch {
    body = null
  }

  // В dev видно прямо в терминале. В проде — в логах хостинга.
  console.log("[CLIENTLOG]", JSON.stringify(body))

  return Response.json({ ok: true })
}
