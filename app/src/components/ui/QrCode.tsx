import { QRCodeSVG } from 'qrcode.react'

export function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  return (
    <div className="inline-flex rounded-2xl bg-white p-3 shadow-lg">
      <QRCodeSVG value={value} size={size} />
    </div>
  )
}
