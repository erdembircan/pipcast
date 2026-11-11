// The promo's sound: the storm and its score (scripts/music/storm.js, rendered
// into public/audio/storm.wav by scripts/prepare.mjs), KLWD's own jingles from
// plugin/station/sounds where the station plays them, and its beat, laid where
// the station lays it (public/audio/promo-beat.wav, scripts/render-beat.mjs).
import { Html5Audio, Sequence, getStaticFiles, staticFile } from 'remotion'

import breakingOut from '../../../plugin/station/sounds/breaking-out.m4a'
import weatherAlert from '../../../plugin/station/sounds/weather-alert.m4a'
import { FPS, JINGLES } from './timeline.ts'

const FILES: Record<string, string> = { 'weather-alert': weatherAlert, 'breaking-out': breakingOut }

/** The score and the storm, the jingles and the beat, as levels of the mix */
const STORM_VOLUME = 0.9
const JINGLE_VOLUME = 0.9
/** The beat a little over the jingles, so the forecast and STORMTRACKER keep the storm's weight */
const BEAT_VOLUME = 1.25

export function PromoSound() {
  const files = getStaticFiles()
  const storm = files.some((file) => file.name === 'audio/storm.wav')
  const beat = files.some((file) => file.name === 'audio/promo-beat.wav')
  return (
    <>
      {storm ? <Html5Audio src={staticFile('audio/storm.wav')} volume={STORM_VOLUME} /> : null}
      {beat ? <Html5Audio src={staticFile('audio/promo-beat.wav')} volume={BEAT_VOLUME} /> : null}
      {JINGLES.map((j) => (
        <Sequence key={`${j.name}-${j.at}`} from={Math.round(j.at * FPS)} layout="none" name={`jingle: ${j.name}`}>
          <Html5Audio src={FILES[j.name]!} trimBefore={Math.round(j.from * FPS)} volume={JINGLE_VOLUME} />
        </Sequence>
      ))}
    </>
  )
}
