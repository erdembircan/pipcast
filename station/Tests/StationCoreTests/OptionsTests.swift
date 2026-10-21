import Testing
@testable import StationCore

@Suite struct OptionsTests {
    func message(_ arguments: [String]) -> String? {
        do {
            _ = try Options.parse(arguments)
            return nil
        } catch let error as OptionsError {
            return error.message
        } catch {
            return "other error"
        }
    }

    @Test func usageIsTheFivePlannedLines() {
        #expect(Options.usage == """
        usage: pipcast-station launch --home <dir> --assets <dir> [--target-bundle-id <id>]
               pipcast-station serve --home <dir> --assets <dir> [--target-bundle-id <id>]
               pipcast-station snapshot --assets <dir> --input <file> --out <file> [--width <points>]
               pipcast-station stop --home <dir>
               pipcast-station --version
        """)
    }

    @Test func errorsGoOutAsTheReasonThenTheUsage() {
        let text = Options.report(OptionsError("missing command"))
        #expect(text == "pipcast-station: missing command\n\(Options.usage)\n")
    }

    @Test func parsesLaunchAndServeWithTheDefaultTarget() throws {
        let launch = try Options.parse(["launch", "--home", "/h", "--assets", "/a"])
        #expect(launch == .launch(StationOptions(home: "/h", assets: "/a", targetBundleID: "com.anthropic.claudefordesktop")))
        let serve = try Options.parse(["serve", "--assets", "/a", "--home", "/h", "--target-bundle-id", "com.x.y"])
        #expect(serve == .serve(StationOptions(home: "/h", assets: "/a", targetBundleID: "com.x.y")))
    }

    @Test func parsesSnapshotWithTheDefaultWidth() throws {
        let command = try Options.parse(["snapshot", "--assets", "/a", "--input", "/i.json", "--out", "/o.png"])
        #expect(command == .snapshot(SnapshotOptions(assets: "/a", input: "/i.json", out: "/o.png", width: 716)))
        let wide = try Options.parse(["snapshot", "--assets", "/a", "--input", "/i", "--out", "/o", "--width", "1920"])
        #expect(wide == .snapshot(SnapshotOptions(assets: "/a", input: "/i", out: "/o", width: 1920)))
    }

    @Test func parsesStopAndVersion() throws {
        #expect(try Options.parse(["stop", "--home", "/h"]) == .stop(home: "/h"))
        #expect(try Options.parse(["--version"]) == .version)
    }

    @Test func aValueMayBeginWithDashes() throws {
        let command = try Options.parse(["launch", "--home", "--odd", "--assets", "--other"])
        #expect(command == .launch(StationOptions(home: "--odd", assets: "--other")))
    }

    @Test func theReasonsAreExact() {
        #expect(message([]) == "missing command")
        #expect(message(["fly"]) == "unknown command fly")
        #expect(message(["--help"]) == "unknown command --help")
        #expect(message(["launch", "--home", "/h", "--assets", "/a", "--fast", "1"]) == "unknown option --fast")
        #expect(message(["stop", "--home", "/h", "--assets", "/a"]) == "unknown option --assets")
        #expect(message(["launch", "stray"]) == "unknown option stray")
        #expect(message(["launch", "--home"]) == "--home needs a value")
        #expect(message(["serve", "--home", "/h", "--assets"]) == "--assets needs a value")
        #expect(message(["launch", "--assets", "/a"]) == "missing --home")
        #expect(message(["serve", "--home", "/h"]) == "missing --assets")
        #expect(message(["stop"]) == "missing --home")
        #expect(message(["snapshot", "--assets", "/a", "--out", "/o"]) == "missing --input")
        #expect(message(["snapshot", "--assets", "/a", "--input", "/i"]) == "missing --out")
        #expect(message(["snapshot", "--input", "/i", "--out", "/o"]) == "missing --assets")
    }

    @Test func widthMustBeANumberFrom320To1920() {
        let reason = "--width must be a number from 320 to 1920"
        for bad in ["319", "1921", "wide", "", "nan"] {
            #expect(message(["snapshot", "--assets", "/a", "--input", "/i", "--out", "/o", "--width", bad]) == reason, "width \(bad)")
        }
        for good in ["320", "716.5", "1920"] {
            #expect(message(["snapshot", "--assets", "/a", "--input", "/i", "--out", "/o", "--width", good]) == nil, "width \(good)")
        }
    }
}
