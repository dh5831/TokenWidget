// 앱 아이콘 생성: swift tools/make_icon.swift <출력.png>
import AppKit

let size: CGFloat = 1024
let img = NSImage(size: NSSize(width: size, height: size))
img.lockFocus()
let inset: CGFloat = 100
let rect = NSRect(x: inset, y: inset, width: size - inset * 2, height: size - inset * 2)
let bg = NSBezierPath(roundedRect: rect, xRadius: 185, yRadius: 185)
NSGradient(starting: NSColor(white: 0.30, alpha: 1), ending: NSColor(white: 0.10, alpha: 1))!.draw(in: bg, angle: -90)
NSColor(white: 1, alpha: 0.12).setStroke()
bg.lineWidth = 6
bg.stroke()

// 위젯처럼 사용량 막대 두 줄
func bar(y: CGFloat, fill: CGFloat) {
    let x: CGFloat = 250, w: CGFloat = 524, h: CGFloat = 64
    NSColor(white: 1, alpha: 0.18).setFill()
    NSBezierPath(roundedRect: NSRect(x: x, y: y, width: w, height: h), xRadius: h / 2, yRadius: h / 2).fill()
    NSColor(white: 1, alpha: 0.9).setFill()
    NSBezierPath(roundedRect: NSRect(x: x, y: y, width: w * fill, height: h), xRadius: h / 2, yRadius: h / 2).fill()
}
bar(y: 520, fill: 0.62)
bar(y: 330, fill: 0.85)

// 상단 스파클 + 터미널 느낌의 점
let font = NSFont.systemFont(ofSize: 150, weight: .semibold)
let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor(white: 1, alpha: 0.9)]
("%" as NSString).draw(at: NSPoint(x: 250, y: 640), withAttributes: attrs)
img.unlockFocus()

let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
