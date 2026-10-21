/// The window shows while any app but the target is frontmost. An unknown
/// frontmost app shows it.
public func shouldShow(frontmost: String?, target: String) -> Bool {
    frontmost != target
}
