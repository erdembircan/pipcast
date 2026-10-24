/// The window shows while any app but the target is frontmost, unless you are on one of the target's own
/// full-screen Spaces: the target fills that screen whichever app is frontmost. An unknown frontmost app
/// shows it.
public func shouldShow(frontmost: String?, target: String, onTargetsOwnSpace: Bool) -> Bool {
    frontmost != target && !onTargetsOwnSpace
}
