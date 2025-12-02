import textToSpeech from "@google-cloud/text-to-speech"

const credentials = JSON.parse(process.env.GOOGLE_TTS_CREDENTIALS_JSON)

const client = new textToSpeech.TextToSpeechClient({
  credentials,
})

async function main() {
  const [result] = await client.listVoices({ languageCode: "uk-UA" })
  console.log("Voices for uk-UA:")
  for (const voice of result.voices ?? []) {
    console.log(
      voice.name,
      voice.ssmlGender,
      voice.naturalSampleRateHertz,
    )
  }
}

main().catch(console.error)
