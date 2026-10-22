import Foundation

/// Mediterranean wind rose: named by the direction the wind comes FROM. Same table as src/wind.ts.
public struct Wind: Equatable, Sendable {
    public let name: String
    public let cardinal: String
    /// Spelled out, as in "da nord-ovest".
    public let direction: String
    public let deg: Double
    /// Southern winds (Scirocco, Ostro, Libeccio) bring warm air.
    public let warm: Bool
}

public let winds: [Wind] = [
    Wind(name: "Tramontana", cardinal: "N", direction: "nord", deg: 0, warm: false),
    Wind(name: "Grecale", cardinal: "NE", direction: "nord-est", deg: 45, warm: false),
    Wind(name: "Levante", cardinal: "E", direction: "est", deg: 90, warm: false),
    Wind(name: "Scirocco", cardinal: "SE", direction: "sud-est", deg: 135, warm: true),
    Wind(name: "Ostro", cardinal: "S", direction: "sud", deg: 180, warm: true),
    Wind(name: "Libeccio", cardinal: "SO", direction: "sud-ovest", deg: 225, warm: true),
    Wind(name: "Ponente", cardinal: "O", direction: "ovest", deg: 270, warm: false),
    Wind(name: "Maestrale", cardinal: "NO", direction: "nord-ovest", deg: 315, warm: false),
]

public func normalizeDeg(_ deg: Double) -> Double {
    (deg.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360)
}

public func windFrom(_ deg: Double) -> Wind {
    // Half-way points round towards the previous sector (22.5° is still Tramontana).
    let sector = Int((normalizeDeg(deg) / 45 - 0.5).rounded(.up)) % 8
    return winds[sector]
}

private let beaufortScale: [(min: Double, label: String)] = [
    (0, "Calma"), (1, "Bava di vento"), (6, "Brezza leggera"), (12, "Brezza tesa"),
    (20, "Vento moderato"), (29, "Vento teso"), (39, "Vento fresco"), (50, "Vento forte"),
    (62, "Burrasca moderata"), (75, "Burrasca forte"), (89, "Tempesta"), (103, "Fortunale"),
    (118, "Uragano"),
]

public func beaufort(_ kmh: Double) -> (force: Int, label: String) {
    let force = beaufortScale.lastIndex { kmh >= $0.min } ?? 0
    return (force, beaufortScale[force].label)
}

/// Below this the app shows "Calma" instead of a wind name.
public let calmBelow = 2.0

public enum SpeedUnit: String, Codable, Sendable {
    case kmh, kn, ms

    public var label: String {
        switch self {
        case .kmh: "km/h"
        case .kn: "nodi"
        case .ms: "m/s"
        }
    }

    public func convert(_ kmh: Double) -> Int {
        let factor: Double = switch self {
        case .kmh: 1
        case .kn: 1 / 1.852
        case .ms: 1 / 3.6
        }
        return Int((kmh * factor).rounded())
    }
}
