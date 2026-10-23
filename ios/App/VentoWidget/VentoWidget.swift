import SwiftUI
import WidgetKit
import WindCore

@main
struct VentoWidgetBundle: WidgetBundle {
    var body: some Widget {
        WindWidget()
    }
}

struct WindWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WindWidget", provider: Provider()) { entry in
            WindWidgetView(entry: entry)
        }
        .configurationDisplayName("Vento")
        .description("Il vento adesso, con raffiche e prossime ore.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

/* ---------- palette: same tokens as src/style.css ---------- */

private extension Color {
    init(_ r: Double, _ g: Double, _ b: Double) { self.init(red: r / 255, green: g / 255, blue: b / 255) }
    static let abyss = Color(8, 32, 42)
    static let petrol = Color(15, 52, 64)
    static let ink = Color(230, 239, 233)
    static let ink2 = Color.ink.opacity(0.68)
    static let ink3 = Color.ink.opacity(0.4)
    static let sea = Color(143, 227, 200)
    static let sand = Color(236, 191, 142)
    static let warn = Color(245, 196, 81)
    static let danger = Color(255, 143, 125)
    static let rain = Color(147, 189, 245)
}

/// The sky glows more as the wind rises, like body::before in the web app.
private func glow(force: Int, warm: Bool) -> Color {
    let t = Double(force) * 0.022
    let accent: (Double, Double, Double) = warm ? (236, 191, 142) : (143, 227, 200)
    let deep: (Double, Double, Double) = (23, 72, 90)
    return Color(deep.0 + (accent.0 - deep.0) * t, deep.1 + (accent.1 - deep.1) * t, deep.2 + (accent.2 - deep.2) * t)
}

private func alertColor(_ level: AlertLevel) -> Color { level == .pericolo ? .danger : .warn }

/* ---------- pieces ---------- */

/// Rose needle in the -10…10 box of needleIcon in src/ui.ts: the bright tip points where the wind comes from.
private struct NeedlePart: Shape {
    let points: [(Double, Double)]

    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 20
        var p = Path()
        p.addLines(points.map { CGPoint(x: rect.midX + $0.0 * s, y: rect.midY + $0.1 * s) })
        p.closeSubpath()
        return p
    }

    static let head = NeedlePart(points: [(0, -9), (3.4, 0), (0, 2.4), (-3.4, 0)])
    static let tail = NeedlePart(points: [(0, 2), (2.6, 0), (0, 8.5), (-2.6, 0)])
}

private struct Needle: View {
    let dir: Double?
    let accent: Color
    var ring = true

    var body: some View {
        ZStack {
            if ring {
                Circle().strokeBorder(Color.ink.opacity(0.2), lineWidth: 1)
                // North mark, so the needle reads as a compass.
                Capsule().fill(Color.ink3).frame(width: 1.5, height: 4).offset(y: -1).frame(maxHeight: .infinity, alignment: .top)
            }
            if let dir {
                ZStack {
                    NeedlePart.tail.fill(Color.ink.opacity(0.4))
                    NeedlePart.head.fill(accent).widgetAccentable()
                }
                .scaleEffect(ring ? 0.82 : 1)
                .rotationEffect(.degrees(dir))
            } else {
                Circle().fill(Color.ink3).frame(width: 5, height: 5)
            }
        }
    }
}

private struct Speed: View {
    let value: Int
    let unit: SpeedUnit
    let size: CGFloat

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text("\(value)").font(.system(size: size, weight: .medium).width(.condensed)).monospacedDigit()
            Text(unit.label).font(.system(size: size * 0.34, weight: .medium).width(.condensed)).foregroundStyle(Color.ink2)
        }
    }
}

/// What the widget shows for one moment.
private struct Reading {
    let point: HourPoint
    let calm: Bool
    let wind: Wind
    let accent: Color

    init(_ p: HourPoint) {
        point = p
        calm = p.speed < calmBelow
        wind = windFrom(p.dir)
        accent = !calm && wind.warm ? .sand : .sea
    }

    var name: String { calm ? "Calma" : wind.name }
    var dir: Double? { calm ? nil : point.dir }
}

/* ---------- families ---------- */

struct WindWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: WindEntry

    var body: some View {
        content.containerBackground(for: .widget) { backdrop }
    }

    @ViewBuilder private var content: some View {
        if let point = entry.point, let snapshot = entry.snapshot {
            let r = Reading(point)
            switch family {
            case .accessoryCircular: Circular(r: r, unit: entry.unit)
            case .accessoryRectangular: Rectangular(r: r, unit: entry.unit, place: snapshot.place.name)
            case .accessoryInline: Label("\(r.name) \(entry.unit.convert(point.speed)) \(entry.unit.label)", systemImage: "wind")
            case .systemMedium: Medium(entry: entry, r: r, snapshot: snapshot)
            default: Small(entry: entry, r: r, snapshot: snapshot)
            }
        } else {
            Empty(family: family, hasPlace: entry.snapshot != nil)
        }
    }

    @ViewBuilder private var backdrop: some View {
        if let point = entry.point {
            let r = Reading(point)
            RadialGradient(
                colors: [glow(force: beaufort(point.speed).force, warm: !r.calm && r.wind.warm), .petrol, .abyss],
                center: UnitPoint(x: 0.5, y: 0.1),
                startRadius: 0,
                endRadius: 260
            )
        } else {
            Color.petrol
        }
    }
}

private struct PlaceRow: View {
    let snapshot: Snapshot
    let alert: GustAlert?
    let age: String?

    var body: some View {
        HStack(spacing: 4) {
            if snapshot.source == .gps {
                Image(systemName: "location.fill").font(.system(size: 8))
            }
            Text(age.map { "\(snapshot.place.name), \($0)" } ?? snapshot.place.name).lineLimit(1)
            Spacer(minLength: 0)
            if let alert {
                Circle().fill(alertColor(alert.level)).frame(width: 7, height: 7)
            }
        }
        .font(.system(size: 12, weight: .medium).width(.condensed))
        .foregroundStyle(Color.ink2)
    }
}

private struct ReadingBlock: View {
    let r: Reading
    let unit: SpeedUnit

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center) {
                Text(r.name)
                    .font(.system(size: 22, weight: .semibold, design: .serif).italic())
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 4)
                Needle(dir: r.dir, accent: r.accent).frame(width: 34, height: 34)
            }
            Speed(value: unit.convert(r.point.speed), unit: unit, size: 38)
            HStack(spacing: 4) {
                Text("raffiche \(unit.convert(r.point.gust))")
                    .foregroundStyle(r.point.gust >= gustWarn ? Color.warn : Color.ink2)
                Spacer(minLength: 0)
                if let rain = rainShort(r.point) {
                    HStack(spacing: 2) {
                        Image(systemName: "drop.fill").font(.system(size: 9))
                        Text(rain)
                    }
                    .foregroundStyle(Color.rain)
                }
            }
            .font(.system(size: 13, weight: .medium).width(.condensed))
            .lineLimit(1)
            .minimumScaleFactor(0.8)
        }
    }
}

private struct Small: View {
    let entry: WindEntry
    let r: Reading
    let snapshot: Snapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PlaceRow(snapshot: snapshot, alert: entry.alert, age: entry.age)
            Spacer(minLength: 2)
            ReadingBlock(r: r, unit: entry.unit)
        }
        .foregroundStyle(Color.ink)
    }
}

private struct Medium: View {
    let entry: WindEntry
    let r: Reading
    let snapshot: Snapshot

    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 0) {
                PlaceRow(snapshot: snapshot, alert: nil, age: entry.age)
                Spacer(minLength: 2)
                ReadingBlock(r: r, unit: entry.unit)
            }
            .frame(width: 128)
            VStack(alignment: .leading, spacing: 6) {
                HoursChart(hours: entry.next, accent: r.accent)
                if let alert = entry.alert {
                    Text(alertLine(alert))
                        .font(.system(size: 12, weight: .semibold).width(.condensed))
                        .foregroundStyle(alertColor(alert.level))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                } else {
                    Text("Prossime 12 ore").font(.system(size: 12, weight: .medium).width(.condensed)).foregroundStyle(Color.ink3)
                }
            }
        }
        .foregroundStyle(Color.ink)
    }

    private func alertLine(_ a: GustAlert) -> String {
        let peak = "\(entry.unit.convert(a.maxGust)) \(entry.unit.label)"
        return a.ongoing ? "Raffiche forti adesso, fino a \(peak)" : "Raffiche fino a \(peak) dalle \(a.start.dropFirst(11).prefix(2))"
    }
}

/// Mean speed and gusts hour by hour, with the 40 km/h warning line and rain underneath, like the 24h chart in the app.
private struct HoursChart: View {
    let hours: [HourPoint]
    let accent: Color

    private static let rainBand: CGFloat = 6

    var body: some View {
        let top = max(gustWarn * 1.5, hours.map(\.gust).max() ?? 0)
        VStack(spacing: 3) {
            GeometryReader { g in
                let slot = g.size.width / CGFloat(max(hours.count, 1))
                let windHeight = g.size.height - Self.rainBand - 2
                let y = { (v: Double) in windHeight * (1 - CGFloat(v / top)) }
                ZStack(alignment: .topLeading) {
                    Path { p in
                        p.move(to: CGPoint(x: 0, y: y(gustWarn)))
                        p.addLine(to: CGPoint(x: g.size.width, y: y(gustWarn)))
                    }
                    .stroke(Color.warn.opacity(0.55), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                    ForEach(Array(hours.enumerated()), id: \.offset) { i, h in
                        let x = CGFloat(i) * slot + slot * 0.2
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill((h.gust >= gustWarn ? Color.warn : accent).opacity(0.28))
                            .frame(width: slot * 0.6, height: max(2, windHeight - y(h.gust)))
                            .offset(x: x, y: y(h.gust))
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(accent)
                            .widgetAccentable()
                            .frame(width: slot * 0.6, height: max(2, windHeight - y(h.speed)))
                            .offset(x: x, y: y(h.speed))
                        if let rh = rainHeight(h) {
                            RoundedRectangle(cornerRadius: 1)
                                .fill(Color.rain.opacity(h.rain >= rainMin ? 1 : 0.4))
                                .frame(width: slot * 0.6, height: rh)
                                .offset(x: x, y: g.size.height - rh)
                        }
                    }
                }
            }
            HStack(spacing: 0) {
                ForEach(Array(hours.enumerated()), id: \.offset) { i, h in
                    Text(i % 3 == 0 ? String(h.time.dropFirst(11).prefix(2)) : " ")
                        .frame(maxWidth: .infinity)
                }
            }
            .font(.system(size: 10, weight: .medium).width(.condensed))
            .foregroundStyle(Color.ink3)
        }
    }

    /// Same scale as rainBar in src/chart.ts: full band from 6 mm, a stub when rain is only possible.
    private func rainHeight(_ h: HourPoint) -> CGFloat? {
        if h.rain >= rainMin { return max(1.5, Self.rainBand * CGFloat((min(h.rain, 6) / 6).squareRoot())) }
        return h.rainChance >= rainPossible ? 1.5 : nil
    }
}

private struct Circular: View {
    let r: Reading
    let unit: SpeedUnit

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                Needle(dir: r.dir, accent: .white, ring: false).frame(width: 18, height: 18)
                Text("\(unit.convert(r.point.speed))").font(.system(size: 17, weight: .semibold).width(.condensed))
            }
        }
    }
}

private struct Rectangular: View {
    let r: Reading
    let unit: SpeedUnit
    let place: String

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 4) {
                Text(r.name).font(.system(size: 17, weight: .semibold, design: .serif).italic())
                Needle(dir: r.dir, accent: .white, ring: false).frame(width: 14, height: 14)
            }
            Text("\(unit.convert(r.point.speed)) \(unit.label), raffiche \(unit.convert(r.point.gust))")
                .font(.system(size: 14, weight: .medium).width(.condensed))
            Text(place).font(.system(size: 12).width(.condensed)).foregroundStyle(.secondary).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct Empty: View {
    let family: WidgetFamily
    let hasPlace: Bool

    var body: some View {
        let text = hasPlace ? "Apri Vento per aggiornare le previsioni" : "Apri Vento per scegliere il posto"
        switch family {
        case .accessoryInline: Label("Apri Vento", systemImage: "wind")
        case .accessoryCircular: ZStack { AccessoryWidgetBackground(); Image(systemName: "wind") }
        case .accessoryRectangular: Label(text, systemImage: "wind").font(.system(size: 13))
        default:
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "wind").font(.system(size: 22)).foregroundStyle(Color.sea)
                Text(text).font(.system(size: 15, weight: .medium, design: .serif).italic()).foregroundStyle(Color.ink)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }
}

#Preview(as: .systemSmall) {
    WindWidget()
} timeline: {
    WindEntry(date: .now, snapshot: .preview, unit: .kmh)
}

#Preview(as: .systemMedium) {
    WindWidget()
} timeline: {
    WindEntry(date: .now, snapshot: .preview, unit: .kn)
}
