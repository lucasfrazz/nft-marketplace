// Gera variantes WebP otimizadas das artes exportadas do Figma.
// Uso: node scripts/build-images.mjs <dir-com-pngs-originais>
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const src = process.argv[2] ?? 'design/source'
const out = 'public/images/nfts'
const map = {
  '8459204731e6eba9d474cbc8ebc37071360d3ba5': 'ape-a',
  '2986a7cb16d09de8970824d2dd58bf0bb021702c': 'ape-b',
  '9df2ff42dd27ba657621c304557d1a855a4be6a5': 'ape-c',
  '87580f2def9af0ce13f4b6f6ce17bb2449bcfc16': 'ape-d',
}
await mkdir(out, { recursive: true })
for (const [hash, name] of Object.entries(map)) {
  for (const w of [160, 320, 640, 960]) {
    await sharp(path.join(src, `${hash}.png`)).resize(w, w).webp({ quality: 78 }).toFile(path.join(out, `${name}-${w}.webp`))
  }
}
console.log('ok')
