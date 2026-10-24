/// The Transparent window button: the symbol it shows and the name VoiceOver reads, for each setting. The symbol says
/// what the setting is, as the speaker does for sound: a window with solid contents while it is off, the same window
/// with its contents a checkerboard, see-through, while it is on. The name says what a press does.
public enum TransparencyButton {
    public static func symbol(transparent: Bool) -> String {
        transparent ? "checkerboard.rectangle" : "rectangle.inset.filled"
    }

    public static func label(transparent: Bool) -> String {
        transparent ? "Make the window solid" : "Make the window transparent"
    }
}
