import Foundation

/// The station's singleton: `station.lock`, held with `flock` for as long as a
/// station serves. The lock is released when this is closed or the process ends.
public final class SingletonLock {
    private var descriptor: Int32

    private init(descriptor: Int32) {
        self.descriptor = descriptor
    }

    /// Takes the lock, or returns nil when another process holds it (or the
    /// file cannot be opened).
    public static func tryAcquire(_ path: String) -> SingletonLock? {
        let descriptor = open(path, O_CREAT | O_RDWR | O_CLOEXEC, 0o600)
        guard descriptor >= 0 else { return nil }
        guard flock(descriptor, LOCK_EX | LOCK_NB) == 0 else {
            Foundation.close(descriptor)
            return nil
        }
        return SingletonLock(descriptor: descriptor)
    }

    public func close() {
        guard descriptor >= 0 else { return }
        flock(descriptor, LOCK_UN)
        Foundation.close(descriptor)
        descriptor = -1
    }

    deinit {
        close()
    }
}
