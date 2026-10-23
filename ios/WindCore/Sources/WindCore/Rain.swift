import Foundation

/// Less than this in an hour is a few drops: the app calls it dry. Same thresholds as src/rain.ts.
public let rainMin = 0.1 // mm
/// From this chance on, rain is worth a mention even when the model expects none.
public let rainPossible = 30.0 // %

/// "0,4", "3", "12": one decimal is enough below 10 mm, none above.
private func mm(_ v: Double) -> String {
    if v >= 10 { return String(Int(v.rounded())) }
    let tenths = (v * 10).rounded() / 10
    let text = tenths == tenths.rounded() ? String(Int(tenths)) : String(tenths)
    return text.replacingOccurrences(of: ".", with: ",")
}

/// Amount when rain is expected, chance when it is only possible, nil when dry. Like rainShort in src/rain.ts.
public func rainShort(_ p: HourPoint) -> String? {
    if p.rain >= rainMin { return "\(mm(p.rain)) mm" }
    if p.rainChance >= rainPossible { return "\(Int(p.rainChance.rounded()))%" }
    return nil
}
