import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import decantCloseup from '../design/extra1.webp'
import decantLineup from '../design/extra2.webp'
import decantSizes from '../design/extra3.webp'
import decantBottles from '../design/extra4.webp'
import fragranceBottles from '../design/inspo.jpg'

const slides = [
  { src: decantLineup, alt: 'Coast Perfumery decants arranged with seashells against a blue backdrop', framing: 'trimmed' },
  { src: decantCloseup, alt: 'Close-up of perfume decants and a seashell on blue glass', framing: 'trimmed' },
  { src: decantSizes, alt: 'Five spray bottles labeled 10, 5, 3, 2, and 1 mL', framing: 'contain' },
  { src: decantBottles, alt: 'Clear decant bottles and seashells on dark green fabric', framing: 'cover' },
  { src: fragranceBottles, alt: 'Assorted full-size perfume bottles arranged on a blue surface', framing: 'cover' },
]

const motionPreference = '(prefers-reduced-motion: reduce)'

export function HeroSlideshow() {
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(() => !window.matchMedia(motionPreference).matches)
  const [hovered, setHovered] = useState(false)
  const rotating = playing && !hovered

  useEffect(() => {
    const preference = window.matchMedia(motionPreference)
    const pauseForReducedMotion = (event: MediaQueryListEvent) => {
      if (event.matches) setPlaying(false)
    }
    preference.addEventListener('change', pauseForReducedMotion)
    return () => preference.removeEventListener('change', pauseForReducedMotion)
  }, [])

  useEffect(() => {
    if (!rotating) return
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 6000)
    return () => window.clearInterval(timer)
  }, [rotating])

  function showSlide(index: number) {
    setPlaying(false)
    setActive((index + slides.length) % slides.length)
  }

  const PlaybackIcon = playing ? Pause : Play

  return (
    <div className="hero-slideshow" role="group" aria-roledescription="carousel" aria-label="Coast Perfumery photos"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocus={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && event.target.matches(':focus-visible')) setPlaying(false)
      }}>
      <div className="hero-slideshow-photos">
        {slides.map(({ src, alt, framing }, index) => (
          <div className={`hero-slide hero-slide-${framing}`} key={src} aria-hidden={index !== active}>
            <img src={src} alt={alt} fetchPriority={index === 0 ? 'high' : 'low'} />
          </div>
        ))}
      </div>
      <div className="hero-slideshow-controls">
        <button className="hero-slideshow-button" type="button" aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} onClick={() => setPlaying(!playing)}>
          <PlaybackIcon aria-hidden="true" size={17} />
        </button>
        <button className="hero-slideshow-button" type="button" aria-label="Previous photo" onClick={() => showSlide(active - 1)}>
          <ChevronLeft aria-hidden="true" size={20} />
        </button>
        <div className="hero-slideshow-dots" role="group" aria-label="Choose a photo">
          {slides.map(({ src }, index) => (
            <button className="hero-slideshow-dot" key={src} type="button" aria-label={`Show photo ${index + 1}`}
              aria-current={index === active ? 'true' : undefined} onClick={() => showSlide(index)} />
          ))}
        </div>
        <button className="hero-slideshow-button" type="button" aria-label="Next photo" onClick={() => showSlide(active + 1)}>
          <ChevronRight aria-hidden="true" size={20} />
        </button>
      </div>
      <p className="sr-only" aria-live={rotating ? 'off' : 'polite'} aria-atomic="true">
        Photo {active + 1} of {slides.length}. {slides[active].alt}
      </p>
    </div>
  )
}
