import { formatPrice } from './catalog'
import { subtotalFor } from './cart'
import type { ReviewedLine } from './cart'

export const emptyCheckout = {
  name: '', phone: '', street: '', barangay: '', city: '', province: '', courier: '', payment: '', notes: '',
}
export type CheckoutFields = typeof emptyCheckout
export type Order = { items: string[]; details: { label: string; value: string }[]; subtotal: number }
export const pending = 'Pending confirmation'

export function makeOrder(fields: CheckoutFields, rows: ReviewedLine[]): Order {
  return {
    items: rows.flatMap(({ line, item }) => item ? [
      `${line.quantity} × ${item.perfume.name} · ${item.variant.concentration} · ${item.size.ml} mL · ${formatPrice(line.quantity * item.size.centavos)} (${formatPrice(item.size.centavos)} each)`,
    ] : []),
    subtotal: subtotalFor(rows),
    details: [
      { label: 'Name', value: fields.name.trim() },
      { label: 'Contact number', value: fields.phone.trim() },
      { label: 'Delivery address', value: [fields.street, fields.barangay, fields.city, fields.province].map((value) => value.trim()).join(', ') },
      { label: 'Preferred courier', value: fields.courier },
      { label: 'Preferred payment', value: fields.payment },
      ...(fields.notes.trim() ? [{ label: 'Notes', value: fields.notes.trim() }] : []),
    ],
  }
}

export function orderText(order: Order) {
  return [
    'Coast Perfumery Manila · Sample order request', '',
    ...order.items, '',
    `Subtotal: ${formatPrice(order.subtotal)}`, `Shipping: ${pending}`, `Final total: ${pending}`, '',
    ...order.details.map(({ label, value }) => `${label}: ${value}`),
  ].join('\n')
}

function wrapText(context: CanvasRenderingContext2D, text: string, width: number) {
  return text.split('\n').flatMap((paragraph) => {
    const lines: string[] = []
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word
      if (context.measureText(candidate).width <= width) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      line = ''
      for (const character of word) {
        if (context.measureText(line + character).width > width) {
          lines.push(line)
          line = ''
        }
        line += character
      }
    }
    return [...lines, line]
  })
}

export async function downloadOrder(order: Order) {
  const canvas = document.createElement('canvas')
  canvas.width = 760
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image export is unavailable.')
  const blocks = [
    { text: 'COAST PERFUMERY MANILA', font: 'bold 20px Arial', color: '#145a62', gap: 12 },
    { text: 'Sample order request', font: '38px Georgia', color: '#142f36', gap: 22 },
    { text: 'DECANTS', font: 'bold 19px Arial', color: '#145a62', gap: 9 },
    ...order.items.map((text) => ({ text, font: '22px Arial', color: '#142f36', gap: 10 })),
    { text: `Subtotal: ${formatPrice(order.subtotal)}\nShipping: ${pending}\nFinal total: ${pending}`, font: 'bold 22px Arial', color: '#145a62', gap: 22 },
    ...order.details.map(({ label, value }) => ({ text: `${label}: ${value}`, font: '22px Arial', color: '#142f36', gap: 10 })),
  ].map((block) => {
    context.font = block.font
    return { ...block, lines: wrapText(context, block.text, 648), lineHeight: Math.ceil(Number(block.font.match(/\d+/)?.[0] ?? 22) * 1.4) }
  })
  canvas.height = 96 + blocks.reduce((height, block) => height + block.lines.length * block.lineHeight + block.gap, 0)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#e0f1f1'
  context.fillRect(0, 0, canvas.width, 20)
  context.textBaseline = 'top'
  let y = 48
  for (const { font, color, lines, gap, lineHeight } of blocks) {
    context.font = font
    context.fillStyle = color
    for (const line of lines) {
      context.fillText(line, 56, y)
      y += lineHeight
    }
    y += gap
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Image export is unavailable.')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'coast-sample-order.png'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
