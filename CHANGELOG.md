# Changelog

All notable changes to Pipcast are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Pipcast adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- A session that has been READY for an hour goes off the air by itself. Press **TUNE IN** to bring it back.

## [1.1.0] - 2026-10-31

### Changed

- The window resizes down to half its full size, where it stopped at 70%. On a 14-inch MacBook Pro that's 358 × 201 pt instead of 501 × 282.
- The window's buttons and minimize handle are sized for each screen, in proportion to the largest the window gets there. On a 14-inch MacBook Pro they keep the size they had.

### Fixed

- On small screens, such as 1024 × 640, the minimize handle no longer runs into the close button when the window is at its smallest.

## [1.0.0] - 2026-10-28

### Added

- KLWD, a picture-in-picture window that floats in a corner of your screen over every app and shows what your Claude Code sessions are up to, styled as a 1990s local TV news broadcast.
- The board: every session on air, one row each, with its project, its title and where it stands (INPUT, ERROR, READY or LIVE), four at a time, and two meters for your account's usage limits.
- BREAKING NEWS when a session needs your input, finishes with changes ready for review, finishes without changing anything, or stops on an error, read by Clawd at the anchor desk, with its jingle and a beat under the story.
- A report every hour on the hour: the station clock, the headlines and THE HOUR IN REVIEW.
- The window never takes the keyboard and hides while Claude is in front. Drag it to another corner, resize it, tuck it into the side of the screen, or let it fade with **Transparent window**. Hover over it for **Close**, **Mute** and **Back to Claude**.
- **TUNE IN** and **TUNE OUT** in the band above the prompt box, and `/pipcast`, `/pipcast auto` and `/pipcast transparency`. **Tune in every new session** is on by default.

[Unreleased]: https://github.com/erdembircan/pipcast/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/erdembircan/pipcast/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/erdembircan/pipcast/releases/tag/v1.0.0
