// The station's typefaces, from the repository's own font files: Anybody for
// everything with station character and Archivo for what has to be read
// quickly. Each frame waits until they have loaded.
import { cancelRender, continueRender, delayRender } from 'remotion'

import anybody from '../../../assets/fonts/anybody.ttf'
import anybodyItalic from '../../../assets/fonts/anybody-italic.ttf'
import archivo from '../../../assets/fonts/archivo.ttf'
import archivoItalic from '../../../assets/fonts/archivo-italic.ttf'

const faces: Array<[string, string, FontFaceDescriptors]> = [
  ['Anybody', anybody, { style: 'normal', weight: '100 900', stretch: '50% 150%' }],
  ['Anybody', anybodyItalic, { style: 'italic', weight: '100 900', stretch: '50% 150%' }],
  ['Archivo', archivo, { style: 'normal', weight: '100 900', stretch: '62% 125%' }],
  ['Archivo', archivoItalic, { style: 'italic', weight: '100 900', stretch: '62% 125%' }],
]

const waiting = delayRender('the station fonts')

Promise.all(
  faces.map(async ([family, url, descriptors]) => {
    const face = new FontFace(family, `url(${url}) format("truetype")`, { display: 'block', ...descriptors })
    await face.load()
    document.fonts.add(face)
  }),
)
  .then(() => continueRender(waiting))
  .catch((error: unknown) => cancelRender(error))
