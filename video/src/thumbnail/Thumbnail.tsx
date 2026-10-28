// The video's YouTube thumbnail: the icon, the name in the serif and the line
// under it, centred on the paper. scripts/thumbnail.mjs renders it into
// assets/youtube-thumbnail.jpg at the repository's root, and the same picture
// as YouTube's embedded player shows it into assets/youtube-thumbnail-play.jpg,
// which the README shows as its link to the video.
import icon from '../../../assets/icon-1024.png'
import { INK, INK_SOFT, PAPER, SANS, SERIF } from '../look/theme.ts'
import { YouTubeOverlay } from './YouTubeOverlay.tsx'

/** YouTube's thumbnail size */
export const THUMBNAIL_W = 1280
export const THUMBNAIL_H = 720

export function Thumbnail() {
  return (
    <div
      style={{
        width: THUMBNAIL_W,
        height: THUMBNAIL_H,
        background: PAPER,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img src={icon} style={{ width: 280, height: 280, filter: 'drop-shadow(0 18px 30px rgba(20,20,19,0.22))' }} />
      <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 132, lineHeight: 1, color: INK, letterSpacing: -2, marginTop: 34 }}>
        Pipcast
      </div>
      <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 34, color: INK_SOFT, marginTop: 18 }}>
        Picture in picture for Claude Code
      </div>
    </div>
  )
}

/** The thumbnail as YouTube's embedded player shows it, for the README */
export function ThumbnailPlay() {
  return (
    <div style={{ position: 'relative', width: THUMBNAIL_W, height: THUMBNAIL_H }}>
      <Thumbnail />
      <YouTubeOverlay width={THUMBNAIL_W} height={THUMBNAIL_H} />
    </div>
  )
}
