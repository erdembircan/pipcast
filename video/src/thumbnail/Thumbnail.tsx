// The video's YouTube thumbnail: the icon, the name in the serif and the line
// under it, centred on the paper. scripts/thumbnail.mjs renders it into
// assets/youtube-thumbnail.jpg at the repository's root, and the same picture
// with YouTube's play button on it into assets/youtube-thumbnail-play.jpg,
// which the README shows as its link to the video.
import icon from '../../../assets/icon-1024.png'
import { INK, INK_SOFT, PAPER, SANS, SERIF } from '../look/theme.ts'

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

/** The width the README shows the thumbnail at, in CSS pixels */
const README_W = 716

// YouTube's large play button as its player draws it: the path, the red and the
// white triangle are the player's own, and it measures 68 by 48 at the README's
// width, as the player's button does, in the middle of the picture.
const PLAY_W = (68 * THUMBNAIL_W) / README_W
const PLAY_H = (48 * THUMBNAIL_W) / README_W

function YouTubePlayButton() {
  return (
    <svg
      viewBox="0 0 68 48"
      style={{
        position: 'absolute',
        left: (THUMBNAIL_W - PLAY_W) / 2,
        top: (THUMBNAIL_H - PLAY_H) / 2,
        width: PLAY_W,
        height: PLAY_H,
      }}
    >
      <path
        d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z"
        fill="#ff0033"
      />
      <path d="M 45,24 27,14 27,34" fill="#fff" />
    </svg>
  )
}

/** The thumbnail with YouTube's play button on it, for the README */
export function ThumbnailPlay() {
  return (
    <div style={{ position: 'relative', width: THUMBNAIL_W, height: THUMBNAIL_H }}>
      <Thumbnail />
      <YouTubePlayButton />
    </div>
  )
}
