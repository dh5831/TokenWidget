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

// macOS 아이콘 그리드: 824pt 둥근 사각형
let tile = CGRect(x: 100, y: 100, width: 824, height: 824)
let tilePath = CGPath(roundedRect: tile, cornerWidth: 185, cornerHeight: 185, transform: nil)

// 그림자
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -12), blur: 28, color: rgb(0x000000, 0.4))
ctx.addPath(tilePath); ctx.setFillColor(rgb(0x2A2C2C)); ctx.fillPath()
ctx.restoreGState()

// 배경: 위젯처럼 반투명 검정-회색 유리 느낌
ctx.saveGState()
ctx.addPath(tilePath); ctx.clip()
let bg = CGGradient(colorsSpace: cs, colors: [rgb(0x4A4E4E), rgb(0x303333), rgb(0x1E2020)] as CFArray, locations: [0, 0.5, 1])!
ctx.drawLinearGradient(bg, start: CGPoint(x: 300, y: 924), end: CGPoint(x: 724, y: 100), options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
let sheen = CGGradient(colorsSpace: cs, colors: [rgb(0xFFFFFF, 0.08), rgb(0xFFFFFF, 0)] as CFArray, locations: [0, 1])!
ctx.drawRadialGradient(sheen, startCenter: CGPoint(x: 260, y: 900), startRadius: 0,
                       endCenter: CGPoint(x: 260, y: 900), endRadius: 600, options: [])
ctx.restoreGState()

// 테두리 하이라이트
ctx.saveGState()
ctx.addPath(tilePath); ctx.setLineWidth(5); ctx.replacePathWithStrokedPath(); ctx.clip()
let rim = CGGradient(colorsSpace: cs, colors: [rgb(0xFFFFFF, 0.30), rgb(0xFFFFFF, 0.06), rgb(0xFFFFFF, 0.12)] as CFArray, locations: [0, 0.5, 1])!
ctx.drawLinearGradient(rim, start: CGPoint(x: 512, y: 924), end: CGPoint(x: 512, y: 100), options: [])
ctx.restoreGState()

// 왼쪽 위 반짝이 (✦)
func sparkle(center p: CGPoint, size s: CGFloat) -> CGPath {
    let path = CGMutablePath()
    let k = s * 0.14
    path.move(to: CGPoint(x: p.x, y: p.y + s))
    path.addQuadCurve(to: CGPoint(x: p.x + s, y: p.y), control: CGPoint(x: p.x + k, y: p.y + k))
    path.addQuadCurve(to: CGPoint(x: p.x, y: p.y - s), control: CGPoint(x: p.x + k, y: p.y - k))
    path.addQuadCurve(to: CGPoint(x: p.x - s, y: p.y), control: CGPoint(x: p.x - k, y: p.y - k))
    path.addQuadCurve(to: CGPoint(x: p.x, y: p.y + s), control: CGPoint(x: p.x - k, y: p.y + k))
    return path
}
ctx.addPath(sparkle(center: CGPoint(x: 320, y: 700), size: 105))
ctx.setFillColor(rgb(0xF2F2F2))
ctx.fillPath()

// 아래 한 줄 막대
let bar = CGRect(x: 210, y: 300, width: 604, height: 76)
ctx.addPath(CGPath(roundedRect: bar, cornerWidth: 38, cornerHeight: 38, transform: nil))
ctx.setFillColor(rgb(0xFFFFFF, 0.16)); ctx.fillPath()
var filled = bar; filled.size.width *= 0.7
ctx.addPath(CGPath(roundedRect: filled, cornerWidth: 38, cornerHeight: 38, transform: nil))
ctx.setFillColor(rgb(0xEDEDED)); ctx.fillPath()

let img = ctx.makeImage()!
try! NSBitmapImageRep(cgImage: img).representation(using: .png, properties: [:])!
    .write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
