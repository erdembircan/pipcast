import Foundation
import StationCore

// The mod reads the lines this prints as they happen; standard output is a
// pipe there, so without this they would sit in a buffer.
setlinebuf(stdout)

let command: Command
do {
    command = try Options.parse(Array(CommandLine.arguments.dropFirst()))
} catch let error as OptionsError {
    FileHandle.standardError.write(Data(Options.report(error).utf8))
    exit(64)
} catch {
    exit(64)
}

switch command {
case .version:
    #if PIPCAST_DEV
    print("pipcast-station \(Constants.version)+dev")
    #else
    print("pipcast-station \(Constants.version)")
    #endif
    exit(0)
case let .launch(options):
    runLaunch(options)
case let .serve(options):
    runServe(options)
case let .snapshot(options):
    runSnapshot(options)
case let .stop(home):
    runStop(home: home)
}
