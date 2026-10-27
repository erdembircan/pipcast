# Developing Pipcast

This is for working on Pipcast itself. To install and use it, see the [README](../README.md).

## How it works

Pipcast has three parts.

- **The mod**, in `packages/mod`, runs inside each Claude Code session. It draws the band, answers `/pipcast`, follows the session's events, and writes what it sees to a small file for that session.
- **The station**, in `station/`, is a native macOS app with one always-on-top window. It reads every session's file and plays the broadcast in that window.
- **The broadcast**, in `packages/director` and `packages/renderer`, is what plays in the window: the director that decides what airs and when, and the KLWD graphics from the design system in `design/`.

The sessions and the station talk only through files in `~/Library/Application Support/Pipcast`. [architecture.md](architecture.md) has the details.

An install gets none of this source. It copies `plugin/`, which holds only what runs, all of it built from the source: the mod bundled into one file, the station's binary, the broadcast's page and its sounds, and the plugin's manifest, icon, README and license.

## Build

Pipcast builds with Node.js 22 or later and the Swift toolchain that comes with Xcode or its Command Line Tools.

```bash
npm ci
```

```bash
scripts/build.sh
```

builds everything an install gets into `plugin/`: the mod bundled into one file, the station, the broadcast's page and its sounds, with the plugin's manifest, icon, README and license. `plugin/` belongs to the build. Don't edit it by hand or keep anything else in it: the build stops when it finds a file there that it doesn't make. Commit what it builds, since an install copies `plugin/` as it is, and CI fails a pull request whose `plugin/` differs from what its sources build.

The build minifies nothing, since Anthropic's plugin directory holds code it can't read for a reviewer. The broadcast's page is its own code, `station.js`, bundled as written, beside React's production files, copied unchanged from its npm package into `plugin/station/web/vendor` with React's license. The page loads React first.

The plugin's icon is KLWD's tower over the city at dusk, its beacon sending out the board's signal. `scripts/build-icon.mjs` draws it in layers from the design system's colours and the band's letters: `assets/icon.svg` stacks them, and `assets/icon-layers` holds each one on its own, as an SVG and as a 2048-pixel PNG, with `layers.json` saying how they stack, for animating the icon. The build draws them every time; their PNGs render only on a Mac, with Chrome, and on CI the build stops when the PNGs were rendered from another drawing.

## The manifest and the listing

The plugin's manifest is `packages/mod/plugin.json`, which the build copies to `plugin/.claude-plugin/plugin.json`. Its `version` is the plugin's version, and the manifest is the only place it is set: the marketplaces' entries leave it out, the station's `Constants.version` and the root `package.json` repeat it, and tests fail when either of them differs.

The plugin's README is `packages/mod/README.md`, which the build copies to `plugin/README.md`. Anthropic's plugin directory shows it as Pipcast's listing, so it is written for someone deciding whether to add Pipcast, and it says everything Pipcast runs, reads and keeps. Its sections **What Pipcast runs and reads** and **Privacy** are in this repository's README too, word for word, and `scripts/check-directory.mjs` fails when the two differ. When Pipcast starts to run, read or keep anything new, say so in both.

The manifest also carries what the directory lists and Claude Code itself ignores: the icon, `assets/icon-1024.png` copied to `plugin/assets/icon.png`; links to the README, the issues and the README's privacy section; and the screenshots, as links to `assets/screenshots` on the master branch.

Two marketplaces list Pipcast as well. Each entry repeats the manifest's display fields, `displayName`, `description`, `author`, `homepage`, `repository`, `license` and `keywords`, because Claude Code shows an entry's own value wherever it sets one:

- **pipcast**, in this repository's `.claude-plugin/marketplace.json`, is for development only, and lists nothing but Pipcast: `scripts/live.sh` installs the live checkout from it, and `scripts/verify-install.sh` installs this clone from it. Nobody installs Pipcast from it. Its entry names `./plugin`, and a test fails when its display fields differ from the manifest's.
- **erdembircan-plugins**, in [erdembircan/plugin-marketplace](https://github.com/erdembircan/plugin-marketplace), is the other place people install Pipcast from, beside Anthropic's plugin directory: a marketplace of your Claude Code plugins, Pipcast among them. Its entry is a `git-subdir` source that installs `plugin/` from this repository's master branch. When a display field changes in the manifest, change it in that entry too.

## Test

```bash
scripts/test.sh
```

runs every check: lint, types, the unit tests of each part, the station's Swift tests, the marketplace and the built plugin validated by the engine bundled with the Claude desktop app, the plugin against the plugin directory's rules, with the engine's own checks and `scripts/check-directory.mjs`, the mod's kit tests against it, and `scripts/live.sh` in a throwaway copy of the repository.

```bash
scripts/verify.sh
```

runs the whole thing for real, with no window of yours involved: a headless Claude Code session tunes in, the station starts and shows its window, the session tunes out, and the station quits. With **Transparent window** on, the window server has to show that window at 40%, or whole while the pointer is on it, and whole once it is off. Another session is renamed on air, off air and after the window's close, and its title on air has to follow each time. One more, with nothing saved for **Tune in every new session**, which leaves it on, has to stay off the air until a stand-in for the desktop app shows it, then tune in by itself, and again after a `/clear`. An install into a throwaway configuration then has to hold exactly the files in `plugin/`, with no source or test among them. There `/pipcast auto` has to say **Tune in every new session** is on before anything is saved, and `/pipcast auto` and `/pipcast transparency` have to turn both settings on and off, each value landing where Claude Code keeps plugin options, and the second in the file the station reads as well.

## Try a change in the desktop app

The desktop app runs the release of Pipcast you installed, from Anthropic's plugin directory or from erdembircan-plugins (`pipcast@erdembircan-plugins`), or the live checkout while you try a change, never both.

The live checkout, `pipcast@pipcast`, is a second checkout of this repository in a folder beside your clone, named after it (`~/Developer/JS/pipcast-live` beside `~/Developer/JS/pipcast`). The `pipcast` marketplace points at it, and every session reads the plugin from its `plugin/` folder when it starts or on `/reload-plugins`. Your clone never changes what the app runs, so you can switch branches in it freely.

`scripts/live.sh` moves the live checkout in and out of the app. It is for development only: it never installs or updates a release. Install the release in the app, as the README says, and update it there.

```bash
scripts/live.sh setup
```

makes the live checkout on master, installs it from the `pipcast` marketplace and puts it in the app.

```bash
scripts/live.sh pr 12
```

puts a pull request in the app. `scripts/live.sh <branch or commit>` puts any other commit there and `scripts/live.sh master` puts master there. Each turns off the release that is on, and remembers which.

```bash
scripts/live.sh published
```

takes the live checkout out and turns that release back on. With no release in Claude Code's plugin list, it still takes the live checkout out, and the app runs no Pipcast from that list. `scripts/live.sh` on its own says what the app runs now. After any of them, run `/reload-plugins` in a session, or start a new one. Only committed work reaches the app, so run `scripts/build.sh` and commit what it builds first.

```bash
scripts/live.sh remove
```

does the same, then takes the live checkout out of Claude Code altogether: it uninstalls `pipcast@pipcast` and removes the `pipcast` marketplace and the live checkout's folder. A station started from the live checkout runs from that folder, so `remove` stops the station first, and a session on air starts it again from the release within half a minute. `scripts/live.sh setup` makes the live checkout again.

A copy from Anthropic's plugin directory is the one release `scripts/live.sh` can't see or turn off. The desktop app hands it to each of its sessions itself, outside Claude Code's plugin list, and runs it over any installed Pipcast, the live checkout too. So while you try a change, turn Pipcast off in **Customize > Plugins**, and back on when you're done.

Each install keeps its own settings, since Claude Code saves a plugin's options under its id.

`/reload-plugins` leaves the station running. After a change to `plugin/station`, stop it, and a session on air starts it again from the live checkout within half a minute:

```bash
~/Developer/JS/pipcast-live/plugin/station/pipcast-station stop --home ~/Library/Application\ Support/Pipcast
```

## Anthropic's plugin directory

People get Pipcast from two places: Anthropic's plugin directory, the catalog under **Customize > Plugins** on claude.ai and in the desktop app, and erdembircan-plugins. A copy added from the directory stays on the claude.ai account: the desktop app downloads it and hands it to each of its sessions itself, outside Claude Code's plugin list, and a terminal session gets it as `pipcast@synced`. Anthropic's official marketplace on GitHub, `anthropics/claude-plugins-official`, takes no submissions: plugins reach the directory through its developer portal, at [claude.ai/directory/manage](https://claude.ai/directory/manage).

The directory reads only `plugin/`. Before a version can go live, it validates the plugin against the [plugin pre-submission checklist](https://claude.com/docs/plugins/pre-submission-checklist), scans it for anything it does that the README doesn't say, and holds it to the [Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy) and the [Software Directory Terms](https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms). Those terms ask for a way to receive reports of security problems: `SECURITY.md` sends people to GitHub's private vulnerability reporting.

```bash
node scripts/check-directory.mjs
```

checks what can be checked here: a README of 40 words or more in `plugin/`, with the two sections it shares with this repository's README; the manifest's name and fields and the license; code that stays readable, with React's files exactly as its npm package has them; the files in `plugin/` that the directory's validator can't inspect, each listed in the script with the reason it ships; and the repository's file names, links and size, which can stop the portal before it reports anything. CI runs it after the build, and so does `scripts/test.sh`.

### What review holds

The station's binary and its six sounds are files the directory's validator can't inspect, so every version is held for a reviewer at Anthropic, and goes live only once the reviewer clears it. A hold isn't a rejection. React's production files, which come minified, and the stylesheet that loads the page's fonts may be held for the same reviewer. The README's **What Pipcast runs and reads** and **Privacy** sections are what the reviewer and the security scan read Pipcast against, so keep them true.

### Submit

1. Put the `release` branch on the commit to submit, as Release, below, says.
2. From the claude.ai account that should own the listing, on a Pro or Max plan, open [claude.ai/directory/manage](https://claude.ai/directory/manage) and select **Submit new**, then **Plugin bundle**.
3. On **Source**, enter `erdembircan/pipcast` as the repository, `plugin` as the plugin path, and `release` as the branch. While the repository is private, the portal asks you to connect GitHub, install the Claude GitHub App on the repository, and agree that its source is uploaded to Anthropic for scanning.
4. Select **Validate**. Fix anything the report marks **Blocking**, push, and select **Re-validate**. The holds above show as **Policy hold**, and don't stop you.
5. **Listing details** come from the manifest and the README.
6. On **Data handling**, the answers are:
   - It reads and keeps personal data, on the Mac only: session titles, folder names, what Claude is doing, Claude's questions and last words, and the account's usage limits, to show them in the window.
   - It sends no data to any service, and makes no network request.
   - A session's file lasts while the session is on air: the session deletes it when it goes off the air or ends, and a file a session left behind is deleted the next time a session goes on air, once it's an hour old.
   - It isn't meant for people under 18.
7. On **Compliance**, check the contact email and select the four acknowledgements.
8. On **Review and submit**, keep **GitHub push webhook**, leave **Auto-publish passing versions** off, and select **Submit for review**.

The listing goes live only once the repository is public. When the reviewer has cleared Pipcast, make the repository public and turn on its private vulnerability reporting, which `SECURITY.md` sends people to and GitHub offers only on public repositories:

```bash
gh api -X PUT repos/erdembircan/pipcast/private-vulnerability-reporting
```

Then select **Check for new commits** on Pipcast's page in the portal, and **Publish**. [Track your directory submission](https://claude.com/docs/directory/submission-status) says what each status in the portal means, and who acts next.

### Try the directory's copy first

The directory installs what is in `plugin/`, and nothing else, and the desktop app hands that copy to each of its sessions itself. Before Pipcast is listed, an upload in the desktop app comes closest: the app installs it in Claude Code as `pipcast@local-desktop-app-uploads` and hands it to each new session the same way. It can't stand in for the rest of a directory copy's way to you: the sync from the claude.ai account, a terminal's `pipcast@synced`, or a directory copy running over an installed Pipcast.

The app writes an upload over any Pipcast already installed in Claude Code, even a disabled one. For the live checkout, that's a cached copy no session reads, so the test would quietly run the old code. Take every installed copy out first:

1. Put the commit to try in the live checkout, and zip its `plugin/`:

   ```bash
   scripts/live.sh pr 12
   ```

   ```bash
   (cd ~/Developer/JS/pipcast-live/plugin && zip -r -X ~/Downloads/pipcast.zip . -x '*.DS_Store')
   ```

2. Tune out every session on air with `/pipcast`, or close it, since a session on air starts the station again from the copy it runs. Then uninstall every `pipcast@…` that `claude plugin list` shows, the live checkout's first, and stop the station:

   ```bash
   claude plugin uninstall pipcast@pipcast
   ```

   ```bash
   ~/Developer/JS/pipcast-live/plugin/station/pipcast-station stop --home ~/Library/Application\ Support/Pipcast
   ```

3. In the desktop app, add `pipcast.zip` with **Customize > Plugins > Add > Upload plugin**, and start a new session.
4. When you're done, remove the upload in **Customize > Plugins**, stop the station again, install again any other copy you uninstalled, and put the live checkout back, on the commit from step 1:

   ```bash
   scripts/live.sh setup
   ```

## Release

People get a new version from each place on its own schedule:

- **Anthropic's plugin directory** follows the `release` branch. A version reaches people there only when `release` moves to it and a reviewer clears it, and they get it as a session starts.
- **erdembircan-plugins** installs `plugin/` from master's newest commit. An install already made moves only with the version: `claude plugin update pipcast@erdembircan-plugins` keeps the copy it has while `version` stays the same, whatever changed in `plugin/`.

So a pull request that changes what `plugin/` holds raises the version too: the patch for a fix, as in 1.0.1, and the minor for something new, as in 1.1.0. Raise it in `packages/mod/plugin.json`, in `Constants.version` in `station/Sources/StationCore/Constants.swift`, and in the root `package.json` and `package-lock.json`; tests fail when they differ. The station's binary carries its version, so run `scripts/build.sh` on a Mac and commit what it builds. Until Pipcast's first release, nobody has a copy to update, so the version stays 1.0.0.

To release a version once it's on master:

1. Tag its commit `v<version>`, as in `v1.1.0`, push the tag, and publish a GitHub release from it.
2. Move `release` to the tag:

   ```bash
   git push origin 'v1.1.0^{commit}:refs/heads/release'
   ```

3. The directory scans the new commit, at once through the push webhook, and holds it for a reviewer. Follow it on Pipcast's **Versions** tab in the [developer portal](https://claude.ai/directory/manage), and select **Publish update** once it's approved.

## The demo video

`video/` holds the demo video, made with [Remotion](https://www.remotion.dev) from the product's own pieces: the design system's components, the band's plate, the jingles and the icon's layers, each played frame by frame. Its soundtrack is synthesised from a score in `video/scripts/music`, in Chrome, as the jingles are. It has dependencies of its own:

```bash
npm --prefix video ci
```

```bash
npm --prefix video run studio
```

opens it in Remotion Studio, rendering the soundtrack first if its score changed. `npm --prefix video run render` renders it to `video/out/pipcast.mp4`, and `render:4k` at twice the size; `video/out/` is not committed.

## README screenshots

The README's three grids of screenshots, `assets/screenshots/in-use.jpg`, `on-air.jpg` and `window.jpg`, are drawn from the demo video's own pieces, in `video/src/readme`: moments of the video's desktop, two states the video only passes through, and KLWD's pictures in its window. With the video's dependencies installed,

```bash
npm --prefix video run readme
```

renders all three again, in Chrome. Render them after a change to what they show, and commit them with it. The picture at the top of the README, `assets/screenshots/breaking.png`, is not one of them.
