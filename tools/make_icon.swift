// 앱 아이콘 생성: swift tools/make_icon.swift <출력.png>
import AppKit

let S: CGFloat = 1024
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: Int(S), height: Int(S), bitsPerComponent: 8, bytesPerRow: 0,
                    space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!

func rgb(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255,
            blue: CGFloat(hex & 0xff) / 255, alpha: a)
}
func gradient(_ colors: [CGColor], _ locs: [CGFloat]) -> CGGradient {
    CGGradient(colorsSpace: cs, colors: colors as CFArray, locations: locs)!
}
let extend: CGGradientDrawingOptions = [.drawsBeforeStartLocation, .drawsAfterEndLocation]

// path 안을 그라데이션으로 채움
func fill(_ path: CGPath, _ g: CGGradient, from a: CGPoint, to b: CGPoint) {
    ctx.saveGState(); ctx.addPath(path); ctx.clip()
    ctx.drawLinearGradient(g, start: a, end: b, options: extend)
    ctx.restoreGState()
}
// path 테두리를 그라데이션으로 그림 (빛 테두리용)
func rim(_ path: CGPath, width: CGFloat, _ g: CGGradient, from a: CGPoint, to b: CGPoint, blur: CGFloat = 0, glow: CGColor? = nil) {
    ctx.saveGState()
    if let glow { ctx.setShadow(offset: .zero, blur: blur, color: glow) }
    ctx.beginTransparencyLayer(auxiliaryInfo: nil)
    ctx.addPath(path); ctx.setLineWidth(width); ctx.replacePathWithStrokedPath(); ctx.clip()
    ctx.drawLinearGradient(g, start: a, end: b, options: extend)
    ctx.endTransparencyLayer()
    ctx.restoreGState()
}

// MARK: 타일 (살짝 투명한 검정 유리)
let tile = CGRect(x: 100, y: 100, width: 824, height: 824)
let tilePath = CGPath(roundedRect: tile, cornerWidth: 185, cornerHeight: 185, transform: nil)

ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -14), blur: 30, color: rgb(0x000000, 0.35))
ctx.addPath(tilePath); ctx.setFillColor(rgb(0x1E2020, 0.88)); ctx.fillPath()
ctx.restoreGState()

fill(tilePath, gradient([rgb(0x515656, 0.55), rgb(0x2A2D2D, 0.25), rgb(0x000000, 0.25)], [0, 0.5, 1]),
     from: CGPoint(x: 300, y: 924), to: CGPoint(x: 724, y: 100))
ctx.saveGState(); ctx.addPath(tilePath); ctx.clip()
ctx.drawRadialGradient(gradient([rgb(0xFFFFFF, 0.10), rgb(0xFFFFFF, 0)], [0, 1]),
                       startCenter: CGPoint(x: 280, y: 880), startRadius: 0,
                       endCenter: CGPoint(x: 280, y: 880), endRadius: 560, options: [])
ctx.restoreGState()
// 타일 테두리: 위는 밝게, 아래는 은은하게
rim(tilePath, width: 6, gradient([rgb(0xFFFFFF, 0.38), rgb(0xFFFFFF, 0.05), rgb(0xFFFFFF, 0.16)], [0, 0.55, 1]),
    from: CGPoint(x: 512, y: 924), to: CGPoint(x: 512, y: 100))

// MARK: 반짝이 (크롬 + 무지개빛 테두리)
func sparkle(center p: CGPoint, size s: CGFloat) -> CGPath {
    let path = CGMutablePath()
    let k = s * 0.14
    path.move(to: CGPoint(x: p.x, y: p.y + s))
    path.addQuadCurve(to: CGPoint(x: p.x + s, y: p.y), control: CGPoint(x: p.x + k, y: p.y + k))
    path.addQuadCurve(to: CGPoint(x: p.x, y: p.y - s), control: CGPoint(x: p.x + k, y: p.y - k))
    path.addQuadCurve(to: CGPoint(x: p.x - s, y: p.y), control: CGPoint(x: p.x - k, y: p.y - k))
    path.addQuadCurve(to: CGPoint(x: p.x, y: p.y + s), control: CGPoint(x: p.x - k, y: p.y + k))
    path.closeSubpath()
    return path
}
let barX: CGFloat = 215, barW: CGFloat = 594, barH: CGFloat = 84
let sc = CGPoint(x: barX + 95, y: 575), ss: CGFloat = 95
let star = sparkle(center: sc, size: ss)

ctx.saveGState()
ctx.setShadow(offset: .zero, blur: 40, color: rgb(0xFFFFFF, 0.28))
ctx.addPath(star); ctx.setFillColor(rgb(0xDDDDDD)); ctx.fillPath()
ctx.restoreGState()
fill(star, gradient([rgb(0xFFFFFF), rgb(0xC9CCCF), rgb(0xB0B4B8), rgb(0xEEF0F2), rgb(0xFFFFFF)], [0, 0.35, 0.55, 0.8, 1]),
     from: CGPoint(x: sc.x - ss, y: sc.y + ss), to: CGPoint(x: sc.x + ss, y: sc.y - ss))
rim(star, width: 5, gradient([rgb(0xFFB070, 0.9), rgb(0xFFFFFF, 0.95), rgb(0x7FB4FF, 0.9)], [0, 0.5, 1]),
    from: CGPoint(x: sc.x - ss, y: sc.y), to: CGPoint(x: sc.x + ss, y: sc.y))

// MARK: 막대 (유리 트랙 + 크롬 채움)
let track = CGRect(x: barX, y: 340, width: barW, height: barH)
let trackPath = CGPath(roundedRect: track, cornerWidth: barH / 2, cornerHeight: barH / 2, transform: nil)
fill(trackPath, gradient([rgb(0x000000, 0.35), rgb(0xFFFFFF, 0.06)], [0, 1]),
     from: CGPoint(x: 0, y: track.maxY), to: CGPoint(x: 0, y: track.minY))
rim(trackPath, width: 4, gradient([rgb(0xFFFFFF, 0.08), rgb(0xFFFFFF, 0.02), rgb(0xFFFFFF, 0.35)], [0, 0.5, 1]),
    from: CGPoint(x: 0, y: track.maxY), to: CGPoint(x: 0, y: track.minY))

var bar = track.insetBy(dx: 7, dy: 7); bar.size.width = (barW - 14) * 0.7
let barPath = CGPath(roundedRect: bar, cornerWidth: bar.height / 2, cornerHeight: bar.height / 2, transform: nil)
ctx.saveGState()
ctx.setShadow(offset: .zero, blur: 34, color: rgb(0xFFFFFF, 0.35))
ctx.addPath(barPath); ctx.setFillColor(rgb(0xE8E8E8)); ctx.fillPath()
ctx.restoreGState()
fill(barPath, gradient([rgb(0xFFFFFF), rgb(0xE4E6E8), rgb(0xA9ADB2), rgb(0xD5D8DB), rgb(0xFFFFFF)], [0, 0.3, 0.6, 0.85, 1]),
     from: CGPoint(x: 0, y: bar.maxY), to: CGPoint(x: 0, y: bar.minY))
// 위쪽 광택 줄
let gloss = CGRect(x: bar.minX + 22, y: bar.maxY - 22, width: bar.width - 44, height: 10)
ctx.addPath(CGPath(roundedRect: gloss, cornerWidth: 5, cornerHeight: 5, transform: nil))
ctx.setFillColor(rgb(0xFFFFFF, 0.9)); ctx.fillPath()
// 무지개빛 테두리
rim(barPath, width: 4, gradient([rgb(0xFFA060, 0.85), rgb(0xFFFFFF, 0.9), rgb(0x6FA8FF, 0.9)], [0, 0.5, 1]),
    from: CGPoint(x: bar.minX, y: 0), to: CGPoint(x: bar.maxX, y: 0))

let img = ctx.makeImage()!
try! NSBitmapImageRep(cgImage: img).representation(using: .png, properties: [:])!
    .write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
