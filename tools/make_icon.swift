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
func lerp(_ a: CGColor, _ b: CGColor, _ t: CGFloat) -> CGColor {
    let x = a.components!, y = b.components!
    return CGColor(srgbRed: x[0] + (y[0] - x[0]) * t, green: x[1] + (y[1] - x[1]) * t,
                   blue: x[2] + (y[2] - x[2]) * t, alpha: x[3] + (y[3] - x[3]) * t)
}

// macOS 아이콘 그리드: 824pt 둥근 사각형
let tile = CGRect(x: 100, y: 100, width: 824, height: 824)
let tilePath = CGPath(roundedRect: tile, cornerWidth: 185, cornerHeight: 185, transform: nil)

// 그림자
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -12), blur: 28, color: rgb(0x000000, 0.45))
ctx.addPath(tilePath); ctx.setFillColor(rgb(0x111113)); ctx.fillPath()
ctx.restoreGState()

// 배경 (터미널 아이콘처럼 짙은 유리 느낌)
ctx.saveGState()
ctx.addPath(tilePath); ctx.clip()
let bg = CGGradient(colorsSpace: cs, colors: [rgb(0x34353A), rgb(0x16161A), rgb(0x0B0B0D)] as CFArray, locations: [0, 0.55, 1])!
ctx.drawLinearGradient(bg, start: CGPoint(x: 512, y: 924), end: CGPoint(x: 512, y: 100), options: [])
// 위쪽 은은한 광택
let sheen = CGGradient(colorsSpace: cs, colors: [rgb(0xFFFFFF, 0.10), rgb(0xFFFFFF, 0)] as CFArray, locations: [0, 1])!
ctx.drawRadialGradient(sheen, startCenter: CGPoint(x: 512, y: 960), startRadius: 0,
                       endCenter: CGPoint(x: 512, y: 960), endRadius: 520, options: [])
ctx.restoreGState()

// 테두리 하이라이트
ctx.saveGState()
ctx.addPath(tilePath); ctx.setLineWidth(5); ctx.replacePathWithStrokedPath(); ctx.clip()
let rim = CGGradient(colorsSpace: cs, colors: [rgb(0xFFFFFF, 0.35), rgb(0xFFFFFF, 0.06), rgb(0xFFFFFF, 0.14)] as CFArray, locations: [0, 0.5, 1])!
ctx.drawLinearGradient(rim, start: CGPoint(x: 512, y: 924), end: CGPoint(x: 512, y: 100), options: [])
ctx.restoreGState()

// 게이지 링
let c = CGPoint(x: 512, y: 500)
let r: CGFloat = 255, lw: CGFloat = 74
let startA: CGFloat = 225 * .pi / 180          // 왼쪽 아래에서 시작
let sweep: CGFloat = 270 * .pi / 180           // 시계 방향 270도
let fill: CGFloat = 0.72

ctx.setLineCap(.round)
ctx.setLineWidth(lw)
ctx.setStrokeColor(rgb(0xFFFFFF, 0.08))
ctx.addArc(center: c, radius: r, startAngle: startA, endAngle: startA - sweep, clockwise: true)
ctx.strokePath()

let stops = [rgb(0x63F2D8), rgb(0x5A9BFF), rgb(0xA77BFF)]
func color(at t: CGFloat) -> CGColor {
    t < 0.5 ? lerp(stops[0], stops[1], t * 2) : lerp(stops[1], stops[2], (t - 0.5) * 2)
}
ctx.saveGState()
ctx.setShadow(offset: .zero, blur: 40, color: rgb(0x6E9BFF, 0.55))
ctx.beginTransparencyLayer(auxiliaryInfo: nil)
let steps = 240
for i in 0..<steps {
    let t0 = CGFloat(i) / CGFloat(steps) * fill, t1 = CGFloat(i + 1) / CGFloat(steps) * fill
    ctx.setStrokeColor(color(at: t0 / fill))
    ctx.setLineCap(i == 0 || i == steps - 1 ? .round : .butt)
    ctx.addArc(center: c, radius: r, startAngle: startA - sweep * t0, endAngle: startA - sweep * t1 - 0.004, clockwise: true)
    ctx.strokePath()
}
ctx.endTransparencyLayer()
ctx.restoreGState()

// 링 위 유리 광택
ctx.saveGState()
ctx.setLineWidth(lw * 0.32)
ctx.setLineCap(.round)
ctx.setStrokeColor(rgb(0xFFFFFF, 0.28))
ctx.addArc(center: c, radius: r + lw * 0.2, startAngle: startA - sweep * 0.08, endAngle: startA - sweep * fill * 0.6, clockwise: true)
ctx.strokePath()
ctx.restoreGState()

// 가운데 반짝이 (✦)
func sparkle(center p: CGPoint, size s: CGFloat) -> CGPath {
    let path = CGMutablePath()
    let k = s * 0.16
    path.move(to: CGPoint(x: p.x, y: p.y + s))
    path.addQuadCurve(to: CGPoint(x: p.x + s, y: p.y), control: CGPoint(x: p.x + k, y: p.y + k))
    path.addQuadCurve(to: CGPoint(x: p.x, y: p.y - s), control: CGPoint(x: p.x + k, y: p.y - k))
    path.addQuadCurve(to: CGPoint(x: p.x - s, y: p.y), control: CGPoint(x: p.x - k, y: p.y - k))
    path.addQuadCurve(to: CGPoint(x: p.x, y: p.y + s), control: CGPoint(x: p.x - k, y: p.y + k))
    return path
}
ctx.saveGState()
ctx.setShadow(offset: .zero, blur: 36, color: rgb(0xFFFFFF, 0.45))
ctx.addPath(sparkle(center: c, size: 120))
ctx.clip()
let sg = CGGradient(colorsSpace: cs, colors: [rgb(0xFFFFFF), rgb(0xD9E4FF)] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(sg, start: CGPoint(x: c.x, y: c.y + 120), end: CGPoint(x: c.x, y: c.y - 120), options: [])
ctx.restoreGState()
ctx.saveGState()
ctx.setShadow(offset: .zero, blur: 30, color: rgb(0xFFFFFF, 0.5))
ctx.addPath(sparkle(center: c, size: 120)); ctx.setFillColor(rgb(0xFFFFFF, 0.0)); ctx.fillPath()
ctx.restoreGState()

let img = ctx.makeImage()!
let rep = NSBitmapImageRep(cgImage: img)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
