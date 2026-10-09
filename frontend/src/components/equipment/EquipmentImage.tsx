import { useEffect, useState } from 'react'
import { equipmentImageCandidates } from '../../equipment/equipmentImages'

type EquipmentImageProps = {
  name: string
  equipmentType?: string | null
  alt: string
  className?: string
}

export function EquipmentImage({ name, equipmentType, alt, className }: EquipmentImageProps) {
  const candidates = equipmentImageCandidates(name, equipmentType)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [name, equipmentType])

  const src = candidates[Math.min(index, candidates.length - 1)]
  const isFallback = src.endsWith('.svg')

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`${className ?? ''} ${isFallback ? 'is-fallback' : ''}`.trim()}
      onError={() => {
        setIndex((current) => (current < candidates.length - 1 ? current + 1 : current))
      }}
    />
  )
}
