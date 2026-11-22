import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import { concentrations, defaultOccasions, effectiveNotes, genders, profiles, samplePhotos } from './catalog'
import type { Notes, Perfume, Variant } from './catalog'

type SizeDraft = { id: string; volume: string; price: string }
type VariantDraft = {
  id: string; concentration: Variant['concentration']; available: boolean; stock: string
  description: string; notes: string[]; images: string[]; sizes: SizeDraft[]
}

const nextId = () => crypto.randomUUID()
const noteLabels = ['Top notes', 'Middle notes', 'Base notes']
const splitTags = (value: string) => [...new Map(value.split(',').map((part) => part.trim()).filter(Boolean).map((tag) => [tag.toLowerCase(), tag])).values()]
const toNotes = (values: string[]): Notes => [splitTags(values[0]), splitTags(values[1]), splitTags(values[2])]

function readPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function PhotoEditor({ label, images, onChange }: { label: string; images: string[]; onChange: (images: string[]) => void }) {
  const [error, setError] = useState('')

  async function upload(files: FileList | null) {
    if (!files?.length) return
    const selected = Array.from(files)
    if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024)) {
      setError('Choose JPEG, PNG, or WebP images up to 4 MB each.')
      return
    }
    if (images.length + selected.length > 6) {
      setError('Use up to six photos.')
      return
    }
    try {
      onChange([...images, ...await Promise.all(selected.map(readPhoto))])
      setError('')
    } catch {
      setError('A photo could not be loaded. Try uploading it again.')
    }
  }

  return (
    <fieldset className="photo-editor">
      <legend>{label}</legend>
      {images.length > 0 && <div className="admin-thumbnails">
        {images.map((image, index) => <div className="admin-photo" key={index}>
          <img src={image} alt={`Photo ${index + 1}`} />
          {index === 0 ? <small>Cover photo</small> : <button className="text-button" type="button" onClick={() => onChange([image, ...images.filter((_, i) => i !== index)])}>Make cover</button>}
          <button className="icon-button" type="button" aria-label={`Remove photo ${index + 1} from ${label}`} onClick={() => onChange(images.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
        </div>)}
      </div>}
      <div className="photo-controls">
        <label className="file-picker secondary-button"><ImagePlus size={17} /> Upload photos
          <input type="file" className="sr-only" aria-label={`Upload ${label.toLowerCase()}`} accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => {
            void upload(event.target.files); event.target.value = ''
          }} />
        </label>
        <label className="field">
          <span className="sr-only">{label} sample photos</span>
          <select value="" onChange={(event) => {
            if (images.length >= 6) { setError('Use up to six photos.'); return }
            if (!images.includes(event.target.value)) onChange([...images, event.target.value])
            setError('')
          }}>
            <option value="">Add sample photo</option>
            {samplePhotos.map(({ name, image }) => <option key={name} value={image}>{name}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </fieldset>
  )
}

function TagField({ label, value, onChange, suggestions }: {
  label: string; value: string; onChange: (value: string) => void; suggestions: string[]
}) {
  return <div className="tag-field">
    <label className="field">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Separate tags with commas" maxLength={300} /></label>
    <label className="field"><span className="sr-only">Reuse {label.toLowerCase()}</span>
      <select value="" onChange={(event) => onChange([...splitTags(value), event.target.value].join(', '))}>
        <option value="">Reuse a tag</option>
        {suggestions.filter((suggestion) => !splitTags(value).some((tag) => tag.toLowerCase() === suggestion.toLowerCase())).map((suggestion) => <option key={suggestion}>{suggestion}</option>)}
      </select>
    </label>
  </div>
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="panel editor-section"><h2>{title}</h2>{children}</section>
}

function newVariant(concentration: Variant['concentration'] = 'EDP'): VariantDraft {
  return { id: nextId(), concentration, available: true, stock: '0', description: '', notes: ['', '', ''], images: [], sizes: [{ id: nextId(), volume: '2', price: '' }] }
}

export function AdminEditor({ perfume, catalog, onSave, onCancel }: {
  perfume?: Perfume; catalog: Perfume[]; onSave: (perfume: Perfume) => void; onCancel: () => void
}) {
  const [name, setName] = useState(perfume?.name ?? '')
  const [brand, setBrand] = useState(perfume?.brand ?? '')
  const [description, setDescription] = useState(perfume?.description ?? '')
  const [profile, setProfile] = useState<Perfume['profile']>(perfume?.profile ?? 'Fresh')
  const [gender, setGender] = useState<Perfume['gender']>(perfume?.gender ?? 'Unisex')
  const [available, setAvailable] = useState(perfume?.available ?? true)
  const [notes, setNotes] = useState(() => perfume?.notes?.map((group) => group.join(', ')) ?? ['', '', ''])
  const [occasions, setOccasions] = useState(perfume?.occasions.join(', ') ?? '')
  const [images, setImages] = useState(() => perfume ? [perfume.image, ...(perfume.gallery ?? [])] : [])
  const [variants, setVariants] = useState<VariantDraft[]>(() => perfume?.variants.map((variant) => ({
    id: variant.id, concentration: variant.concentration, available: variant.available, stock: String(variant.remainingMl),
    description: variant.description ?? '', notes: variant.notes?.map((group) => group.join(', ')) ?? ['', '', ''],
    images: variant.images ?? [], sizes: variant.sizes.map((size) => ({ id: size.id, volume: String(size.ml), price: String(size.centavos / 100) })),
  })) ?? [newVariant()])
  const [error, setError] = useState('')
  const noteSuggestions = [...new Set(catalog.flatMap((item) => item.variants.flatMap((variant) => effectiveNotes(item, variant).flat())))].sort()
  const occasionSuggestions = [...new Set([...defaultOccasions, ...catalog.flatMap((item) => item.occasions)])].sort()
  const freeConcentration = concentrations.find((concentration) => !variants.some((variant) => variant.concentration === concentration))

  function patchVariant(id: string, patch: Partial<VariantDraft>) {
    setVariants((current) => current.map((variant) => variant.id === id ? { ...variant, ...patch } : variant))
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanedName = name.trim()
    const cleanedBrand = brand.trim()
    if (!cleanedName || !cleanedBrand || !description.trim() || !images.length) {
      setError('Enter a name, brand, and description, then add a cover photo.')
      return
    }
    if (!variants.length || new Set(variants.map(({ concentration }) => concentration)).size !== variants.length) {
      setError('Add at least one concentration and keep concentration names unique.')
      return
    }
    for (const variant of variants) {
      const stock = Number(variant.stock)
      const volumes = variant.sizes.map(({ volume }) => Number(volume))
      if (!variant.stock.trim() || !Number.isSafeInteger(Math.round(stock * 100)) || stock < 0 || !variant.sizes.length || new Set(volumes).size !== volumes.length
        || variant.sizes.some(({ volume, price }) => !/^\d+(?:\.\d{1,2})?$/.test(volume) || Number(volume) <= 0
          || !Number.isSafeInteger(Math.round(Number(volume) * 100))
          || !/^\d+(?:\.\d{1,2})?$/.test(price) || Number(price) <= 0 || !Number.isSafeInteger(Math.round(Number(price) * 100)))) {
        setError(`Check ${variant.concentration}. Enter a nonnegative stock count and unique, positive sizes with prices of up to two decimal places.`)
        return
      }
    }
    const baseSlug = cleanedName.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'perfume'
    let id = perfume?.id ?? baseSlug
    for (let suffix = 2; !perfume && catalog.some((item) => item.id === id); suffix++) id = `${baseSlug}-${suffix}`
    onSave({
      id, name: cleanedName, brand: cleanedBrand, description: description.trim(), profile, gender, available,
      image: images[0], gallery: images.slice(1), notes: toNotes(notes), occasions: splitTags(occasions),
      variants: variants.map((variant) => {
        const original = perfume?.variants.find(({ id }) => id === variant.id)
        return {
          id: original && original.concentration !== variant.concentration ? nextId() : variant.id,
          concentration: variant.concentration, available: variant.available, remainingMl: Number(variant.stock),
          description: variant.description.trim() || undefined, notes: variant.notes.some((value) => value.trim()) ? toNotes(variant.notes) : undefined,
          images: variant.images.length ? variant.images : undefined,
          sizes: variant.sizes.map(({ id: sizeId, volume, price }) => {
            const ml = Number(volume)
            const originalSize = original?.sizes.find(({ id }) => id === sizeId)
            return { id: originalSize && originalSize.ml !== ml ? nextId() : sizeId, ml, centavos: Math.round(Number(price) * 100) }
          }).sort((a, b) => a.ml - b.ml),
        }
      }),
    })
  }

  return <form className="admin-editor" onSubmit={save}>
    <EditorSection title="Listing details">
      <div className="form-grid">
        <label className="field">Perfume name<input required value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></label>
        <label className="field">Brand<input required value={brand} maxLength={80} onChange={(event) => setBrand(event.target.value)} /></label>
        <label className="field">Scent profile<select value={profile} onChange={(event) => setProfile(event.target.value as Perfume['profile'])}>{profiles.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="field">Gender<select value={gender} onChange={(event) => setGender(event.target.value as Perfume['gender'])}>{genders.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="field form-wide">Description<textarea rows={3} value={description} required maxLength={1500} onChange={(event) => setDescription(event.target.value)} /></label>
      </div>
      <label className="switch-label"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} /> Make listing orderable</label>
    </EditorSection>
    <EditorSection title="Shared photos and notes">
      <PhotoEditor label="Listing photos" images={images} onChange={setImages} />
      <TagField label="Occasions" value={occasions} onChange={setOccasions} suggestions={occasionSuggestions} />
      {notes.map((value, index) => <TagField key={index} label={noteLabels[index]} value={value} suggestions={noteSuggestions} onChange={(change) => setNotes(notes.map((current, i) => i === index ? change : current))} />)}
    </EditorSection>
    <EditorSection title="Concentrations and decant prices">
      {variants.map((variant) => <fieldset className="variant-editor" key={variant.id}>
        <legend>{variant.concentration} variant</legend>
        <div className="form-grid">
          <label className="field">Concentration<select value={variant.concentration} onChange={(event) => patchVariant(variant.id, { concentration: event.target.value as Variant['concentration'] })}>
            {concentrations.map((value) => <option key={value} disabled={variants.some((other) => other.id !== variant.id && other.concentration === value)}>{value}</option>)}
          </select></label>
          {perfume?.variants.some(({ id }) => id === variant.id)
            ? <p className="notice">Remaining volume is managed in Inventory.</p>
            : <label className="field">Initial stock (mL)<input required type="number" min="0" step="0.01" value={variant.stock} onChange={(event) => patchVariant(variant.id, { stock: event.target.value })} /></label>}
        </div>
        <label className="switch-label"><input type="checkbox" checked={variant.available} onChange={(event) => patchVariant(variant.id, { available: event.target.checked })} /> Make {variant.concentration} orderable</label>
        <div className="size-editor">
          {variant.sizes.map((size, index) => <div className="size-editor-row" key={size.id}>
            <label className="field">Size (mL)<input required type="number" min=".01" step=".01" value={size.volume} onChange={(event) => patchVariant(variant.id, { sizes: variant.sizes.map((entry) => entry.id === size.id ? { ...entry, volume: event.target.value } : entry) })} /></label>
            <label className="field">Price (₱)<input required type="number" min=".01" step=".01" value={size.price} onChange={(event) => patchVariant(variant.id, { sizes: variant.sizes.map((entry) => entry.id === size.id ? { ...entry, price: event.target.value } : entry) })} /></label>
            <button className="icon-button" type="button" aria-label={`Remove size ${index + 1} from ${variant.concentration}`} disabled={variant.sizes.length <= 1} onClick={() => patchVariant(variant.id, { sizes: variant.sizes.filter((entry) => entry.id !== size.id) })}><Trash2 size={16} /></button>
          </div>)}
          <button className="secondary-button" type="button" onClick={() => patchVariant(variant.id, { sizes: [...variant.sizes, { id: nextId(), volume: '', price: '' }] })}><Plus size={16} /> Add decant size</button>
        </div>
        <details className="editor-overrides">
          <summary>Concentration-specific details</summary>
          <label className="field">Description override<textarea value={variant.description} rows={2} maxLength={1500} onChange={(event) => patchVariant(variant.id, { description: event.target.value })} /></label>
          <PhotoEditor label={`${variant.concentration} photos`} images={variant.images} onChange={(photos) => patchVariant(variant.id, { images: photos })} />
          {variant.notes.map((value, index) => <TagField key={index} label={`${variant.concentration} ${noteLabels[index].toLowerCase()}`} value={value} suggestions={noteSuggestions} onChange={(change) => patchVariant(variant.id, { notes: variant.notes.map((current, i) => i === index ? change : current) })} />)}
        </details>
        {variants.length > 1 && <button type="button" className="danger-text" onClick={() => setVariants(variants.filter(({ id }) => id !== variant.id))}>Remove {variant.concentration} variant</button>}
      </fieldset>)}
      {freeConcentration && <button className="secondary-button" type="button" onClick={() => setVariants([...variants, newVariant(freeConcentration)])}><Plus size={16} /> Add concentration</button>}
    </EditorSection>
    {error && <p className="notice field-error" role="alert">{error}</p>}
    <div className="editor-actions">
      <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      <button type="submit" className="primary-button">{perfume ? 'Save listing' : 'Publish sample listing'}</button>
    </div>
  </form>
}
