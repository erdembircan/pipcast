import Foundation
import StationCore

func fail(_ reason: String) -> Never {
    FileHandle.standardError.write(Data("pipcast-station: \(reason)\n".utf8))
    exit(1)
}

/// An absolute, tidy path for an option that may have been given relative.
func absolutePath(_ path: String) -> String {
    URL(fileURLWithPath: path).standardizedFileURL.path
}

/// Creates the home and its `sessions/` folder (mode 0700) when missing.
func prepareHome(_ paths: StorePaths) throws {
    let attributes: [FileAttributeKey: Any] = [.posixPermissions: 0o700]
    try FileManager.default.createDirectory(atPath: paths.root, withIntermediateDirectories: true, attributes: attributes)
    try FileManager.default.createDirectory(atPath: paths.sessions, withIntermediateDirectories: true, attributes: attributes)
}

/// The path of this very executable, with symbolic links resolved.
func ownExecutablePath() -> String {
    var size: UInt32 = 0
    _NSGetExecutablePath(nil, &size)
    var buffer = [CChar](repeating: 0, count: Int(size))
    _NSGetExecutablePath(&buffer, &size)
    return URL(fileURLWithPath: String(cString: buffer)).resolvingSymlinksInPath().path
}

/// `launch`: starts a station unless one is serving, and returns at once. The
/// mod runs it with a timeout and must never wait on the station.
func runLaunch(_ options: StationOptions) -> Never {
    let paths = StorePaths(home: absolutePath(options.home))
    do {
        try prepareHome(paths)
    } catch {
        fail("cannot start: \(error.localizedDescription)")
    }

    guard let lock = SingletonLock.tryAcquire(paths.lock) else {
        if let status = StationStatus.read(from: paths.station) {
            print("running \(status.pid)")
        } else {
            print("running")
        }
        exit(0)
    }
    // Nobody serves. Let go of the lock for the station to take.
    lock.close()

    var arguments = ["serve", "--home", paths.root, "--assets", absolutePath(options.assets),
                     "--target-bundle-id", options.targetBundleID]
    arguments.insert(ownExecutablePath(), at: 0)

    var actions: posix_spawn_file_actions_t?
    posix_spawn_file_actions_init(&actions)
    defer { posix_spawn_file_actions_destroy(&actions) }
    posix_spawn_file_actions_addopen(&actions, 0, "/dev/null", O_RDONLY, 0)
    posix_spawn_file_actions_addopen(&actions, 1, "/dev/null", O_WRONLY, 0)
    posix_spawn_file_actions_addopen(&actions, 2, "/dev/null", O_WRONLY, 0)

    // A session of its own, so the station outlives whoever started it; and
    // nothing else of this process's open files carries over.
    var attributes: posix_spawnattr_t?
    posix_spawnattr_init(&attributes)
    defer { posix_spawnattr_destroy(&attributes) }
    posix_spawnattr_setflags(&attributes, Int16(POSIX_SPAWN_SETSID | POSIX_SPAWN_CLOEXEC_DEFAULT))

    var argv: [UnsafeMutablePointer<CChar>?] = arguments.map { strdup($0) }
    argv.append(nil)
    defer { argv.forEach { free($0) } }

    var pid: pid_t = 0
    let status = posix_spawn(&pid, arguments[0], &actions, &attributes, argv, environ)
    guard status == 0 else {
        fail("cannot start: \(String(cString: strerror(status)))")
    }
    print("started \(pid)")
    exit(0)
}

/// `stop`: asks the running station to quit.
func runStop(home: String) -> Never {
    let paths = StorePaths(home: absolutePath(home))
    // The lock is held exactly while a station serves; a pid in a stale
    // station.json may belong to someone else by now.
    guard FileManager.default.fileExists(atPath: paths.root) else {
        print("not running")
        exit(0)
    }
    if let lock = SingletonLock.tryAcquire(paths.lock) {
        lock.close()
        print("not running")
        exit(0)
    }
    guard let status = StationStatus.read(from: paths.station) else {
        print("not running")
        exit(0)
    }
    kill(pid_t(status.pid), SIGTERM)
    // Return once the lock is free, so that a launch right after finds no station.
    let deadline = Date().addingTimeInterval(3)
    while Date() < deadline {
        if let lock = SingletonLock.tryAcquire(paths.lock) {
            lock.close()
            break
        }
        Thread.sleep(forTimeInterval: 0.05)
    }
    print("stopped \(status.pid)")
    exit(0)
}
