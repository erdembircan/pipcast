// Where the store keeps each file. `home` is the store's folder:
// ~/Library/Application Support/Pipcast, or PIPCAST_HOME when it is set.

import { STORE_FOLDER } from './constants.ts'

export function defaultHome(userHome: string): string {
  return `${userHome.replace(/\/+$/, '')}/Library/Application Support/${STORE_FOLDER}`
}

export function storePaths(home: string) {
  const root = home.replace(/\/+$/, '')
  return {
    root,
    sessions: `${root}/sessions`,
    session: (id: string) => `${root}/sessions/${id}.json`,
    station: `${root}/station.json`,
    control: `${root}/control.json`,
    prefs: `${root}/prefs.json`,
    options: `${root}/options.json`,
    lock: `${root}/station.lock`,
    log: `${root}/station.log`,
  }
}

export type StorePaths = ReturnType<typeof storePaths>
