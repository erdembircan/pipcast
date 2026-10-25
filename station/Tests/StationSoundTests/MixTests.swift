import Testing
@testable import StationSound

@Suite struct MixTests {
    @Test func theBeatMixesInEvenlyFromSilence() {
        #expect(mixInGain(0) == 0)
        #expect(mixInGain(0.5) == 0.5)
        #expect(mixInGain(1) == 1)
        #expect(mixInGain(2) == 1)
    }

    @Test func theBeatPhasesOutAsTheSquareOfWhatIsLeft() {
        #expect(phaseOutGain(0) == 1)
        #expect(phaseOutGain(0.5) == 0.25)
        #expect(abs(phaseOutGain(0.72) - 0.0784) < 1e-6)
        #expect(phaseOutGain(1) == 0)
        #expect(phaseOutGain(-1) == 1)
    }

    @Test func aHushFallsEvenlyToSilence() {
        #expect(hushGain(0) == 1)
        #expect(hushGain(0.25) == 0.75)
        #expect(hushGain(1) == 0)
    }
}
