import AppKit
import Testing
@testable import StationCore

@Suite struct TransparencyButtonTests {
    @Test func theSymbolSaysWhatTheSettingIs() {
        #expect(TransparencyButton.symbol(transparent: false) == "rectangle.inset.filled")
        #expect(TransparencyButton.symbol(transparent: true) == "checkerboard.rectangle")
    }

    @Test func theNameSaysWhatAPressDoes() {
        #expect(TransparencyButton.label(transparent: false) == "Make the window transparent")
        #expect(TransparencyButton.label(transparent: true) == "Make the window solid")
    }

    @Test func macOSHasBothSymbols() {
        for transparent in [false, true] {
            let name = TransparencyButton.symbol(transparent: transparent)
            #expect(NSImage(systemSymbolName: name, accessibilityDescription: nil) != nil, "\(name)")
        }
    }
}
