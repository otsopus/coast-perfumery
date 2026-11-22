import citrus from './assets/citrus.jpg'
import floral from './assets/floral.jpg'
import fresh from './assets/fresh.jpg'
import woody from './assets/woody.jpg'

export const profiles = ['Fresh', 'Citrus', 'Floral', 'Woody'] as const

type Profile = (typeof profiles)[number]
type Notes = readonly [top: string[], middle: string[], base: string[]]

type Variant = {
  concentration: 'EDP' | 'EDT' | 'Extrait'
  notes: Notes
  sizes: { ml: number; centavos: number }[]
}

export type Perfume = {
  id: string
  name: string
  brand: string
  profile: Profile
  image: string
  description: string
  gender: 'Unisex' | 'Feminine' | 'Masculine'
  occasions: string[]
  available: boolean
  variants: Variant[]
}

function variant(concentration: Variant['concentration'], notes: Notes, prices: number[]): Variant {
  return {
    concentration,
    notes,
    sizes: prices.map((pesos, index) => ({ ml: [2, 5, 10][index], centavos: pesos * 100 })),
  }
}

export const catalog: Perfume[] = [
  {
    id: 'saltwater-linen', name: 'Saltwater Linen', brand: 'Maison Marea', profile: 'Fresh',
    image: fresh, gender: 'Unisex', occasions: ['Everyday', 'Office'], available: true,
    description: 'Sea salt and bright bergamot settle into airy cypress and dry cedarwood.',
    variants: [
      variant('EDP', [['Sea salt', 'Bergamot'], ['Cypress', 'Clary sage'], ['Cedarwood', 'Vetiver']], [149, 295, 520]),
      variant('EDT', [['Bergamot', 'Lemon'], ['Cypress'], ['Cedarwood']], [129, 255, 430]),
    ],
  },
  {
    id: 'citrus-tide', name: 'Citrus Tide', brand: 'Isla Atelier', profile: 'Citrus',
    image: citrus, gender: 'Unisex', occasions: ['Everyday', 'Office'], available: true,
    description: 'A crisp opening of grapefruit and bergamot softens into neroli and white musk.',
    variants: [variant('EDT', [['Grapefruit', 'Bergamot'], ['Neroli', 'Green tea'], ['White musk']], [119, 239, 429])],
  },
  {
    id: 'petal-mist', name: 'Petal Mist', brand: 'Atelier Virelle', profile: 'Floral',
    image: floral, gender: 'Feminine', occasions: ['Date night', 'Special occasion'], available: true,
    description: 'Juicy pear and pink pepper lift an iris and jasmine heart over soft sandalwood.',
    variants: [variant('Extrait', [['Pear', 'Pink pepper'], ['Iris', 'Jasmine'], ['White musk', 'Sandalwood']], [185, 340, 645])],
  },
  {
    id: 'amber-drift', name: 'Amber Drift', brand: 'Maison Marea', profile: 'Woody',
    image: woody, gender: 'Masculine', occasions: ['Date night', 'Special occasion'], available: true,
    description: 'Cardamom warms a base of amber, cedarwood, and vanilla.',
    variants: [variant('EDP', [['Cardamom', 'Black pepper'], ['Cedarwood'], ['Amber', 'Vanilla']], [159, 305, 550])],
  },
  {
    id: 'clearwater', name: 'Clearwater', brand: 'Isla Atelier', profile: 'Fresh',
    image: fresh, gender: 'Unisex', occasions: ['Everyday'], available: true,
    description: 'Cool mint and green tea with a transparent sea salt finish.',
    variants: [variant('EDT', [['Mint', 'Lemon'], ['Green tea'], ['Sea salt', 'White musk']], [129, 250, 445])],
  },
  {
    id: 'dusk-jasmine', name: 'Dusk Jasmine', brand: 'Atelier Virelle', profile: 'Floral',
    image: floral, gender: 'Feminine', occasions: ['Special occasion'], available: false,
    description: 'Jasmine and orange blossom deepen into vanilla and amber.',
    variants: [variant('EDP', [['Orange blossom'], ['Jasmine', 'Iris'], ['Amber', 'Vanilla']], [169, 325, 590])],
  },
]

export const noteOptions = [...new Set(catalog.flatMap((perfume) => (
  perfume.variants.flatMap(({ notes }) => notes.flat())
)))].sort()

export const lowestPrice = (variants: Perfume['variants']) => Math.min(
  ...variants.flatMap(({ sizes }) => sizes.map(({ centavos }) => centavos)),
)

const pesos = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2, minimumFractionDigits: 0 })
export const formatPrice = (centavos: number) => pesos.format(centavos / 100)
