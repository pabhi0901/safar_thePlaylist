import { useEffect, useMemo, useRef, useState } from 'react'
import bgImage from './bgImage/busss.png'
import songData from './song.json'

const formatTime = (value = 0) => {
  const s = Number.isFinite(value) ? value : 0
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

const parseDuration = (value) => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const [m = '0', s = '0'] = value.split(':')
    const pm = Number(m), ps = Number(s)
    if (Number.isFinite(pm) && Number.isFinite(ps)) return pm * 60 + ps
  }
  return 0
}

const useLiveClock = () => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

// ── Fog wisps ──────────────────────────────────────────
const FogLayer = () => {
  const wisps = useMemo(() => [
    // ground fog — wide, warm (bus-light tinted), slow
    { id:1,  top:65, dH:32, dV:20, dyH:0,  dyV:4,  w:90,  h:140, dirH: 1, dirV: 1,  clr:'warm', blur:34 },
    { id:2,  top:72, dH:20, dV:14, dyH:1,  dyV:7,  w:75,  h:105, dirH:-1, dirV: 1,  clr:'warm', blur:30 },
    { id:3,  top:68, dH:26, dV:17, dyH:5,  dyV:10, w:60,  h:115, dirH:-1, dirV:-1,  clr:'warm', blur:24 },
    // mid-level — cool blue, varying speed
    { id:4,  top:50, dH:22, dV:15, dyH:6,  dyV:0,  w:65,  h:100, dirH:-1, dirV:-1,  clr:'cool', blur:22 },
    { id:5,  top:55, dH:16, dV:11, dyH:4,  dyV:8,  w:42,  h:80,  dirH: 1, dirV:-1,  clr:'cool', blur:16 },
    { id:6,  top:58, dH:38, dV:24, dyH:9,  dyV:3,  w:82,  h:120, dirH: 1, dirV: 1,  clr:'cool', blur:40 },
    // wide background wash — barely visible, very slow
    { id:7,  top:52, dH:50, dV:32, dyH:8,  dyV:2,  w:110, h:190, dirH: 1, dirV:-1,  clr:'cool', blur:50 },
    // upper wisps — cool, lighter
    { id:8,  top:40, dH:36, dV:22, dyH:12, dyV:8,  w:58,  h:85,  dirH: 1, dirV: 1,  clr:'cool', blur:20 },
    { id:9,  top:44, dH:28, dV:18, dyH:9,  dyV:5,  w:70,  h:92,  dirH:-1, dirV:-1,  clr:'cool', blur:32 },
    // fast small streak
    { id:10, top:60, dH:14, dV:9,  dyH:3,  dyV:6,  w:38,  h:65,  dirH:-1, dirV: 1,  clr:'warm', blur:14 },
  ], [])

  return (
    <div className="fog-layer" aria-hidden="true">
      <div className="fog-base" />
      {wisps.map(w => (
        <div key={w.id} className="fog-h" style={{
          top: `${w.top}%`,
          width: `${w.w}vw`,
          height: `${w.h}px`,
          '--dur-h':   `${w.dH}s`,
          '--delay-h': `${w.dyH}s`,
          '--dir-h':    w.dirH,
        }}>
          <div className={`fog-wisp fog-wisp--${w.clr}`} style={{
            '--dur-v':   `${w.dV}s`,
            '--delay-v': `${w.dyV}s`,
            '--dir-v':    w.dirV,
            filter: `blur(${w.blur}px)`,
          }} />
        </div>
      ))}
    </div>
  )
}

// ── Single indicator dot ────────────────────────────────────
const IndLight = ({ isOn }) => (
  <span className={`ind-dot${isOn ? ' ind-dot--on' : ''}`} aria-hidden="true" />
)

const App = () => {
  const songs = useMemo(
    () => songData.map((s) => ({ ...s, durationSeconds: parseDuration(s.duration) })),
    [],
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPlaying, setIsPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]       = useState(songs[0]?.durationSeconds ?? 0)
  const [indOn, setIndOn]             = useState(true)   // indicator sync state
  const audioRef = useRef(null)
  const now = useLiveClock()

  // single source of truth — both dots react to same toggle
  useEffect(() => {
    const id = setInterval(() => setIndOn(v => !v), 600)
    return () => clearInterval(id)
  }, [])

  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const activeSong = songs[activeIndex]

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !activeSong) return
    audio.src = activeSong.url
    audio.load()
    setCurrentTime(0)
    setDuration(activeSong.durationSeconds)
    if (isPlaying) audio.play().catch(() => setIsPlaying(false))
  }, [activeSong, isPlaying])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime || 0)
    const onMeta = () => setDuration(audio.duration || activeSong?.durationSeconds || 0)
    const onEnd  = () => { setActiveIndex((i) => (i + 1) % songs.length); setIsPlaying(true) }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnd)
    }
  }, [activeSong, songs.length])

  const handlePlayPause = async () => {
    const audio = audioRef.current
    if (!audio || !activeSong) return
    if (isPlaying) { audio.pause(); setIsPlaying(false); return }
    try { await audio.play(); setIsPlaying(true) } catch { setIsPlaying(false) }
  }

  const handleNext = () => { setActiveIndex((i) => (i + 1) % songs.length); setIsPlaying(true) }
  const handlePrev = () => { setActiveIndex((i) => (i - 1 + songs.length) % songs.length); setIsPlaying(true) }

  const progressPercent = useMemo(() => {
    if (!duration) return 0
    return Math.min(100, Math.max(0, (currentTime / duration) * 100))
  }, [currentTime, duration])

  return (
    <main className="app-shell" style={{ backgroundImage: `url(${bgImage})` }}>

      <FogLayer />

      {/* ── Top Bar ── */}
      <div className="top-bar">
        <div className="pill">
          <span className="pill-icon">◔</span>
          <span>
            <strong>{timeStr}</strong>
            <small>{dateStr}</small>
          </span>
        </div>
        <div className="status-pill">
          <span className="status-dot" />
          <span>Online</span>
        </div>
      </div>

      {/* ── Centered Block: Title + Quote + Road Lines ── */}
      <div className="center-block" aria-label="सफ़र जारी है">
        <h1 className="hero-title">
          <span className="safar-word">सफ़र</span>
          <span className="jaari-word">जारी है...</span>
        </h1>

        <p className="hero-quote">
          कुछ रास्ते हमें मंज़िल तक नहीं,<br />
          ख़ुद तक ले जाते हैं।
        </p>

        <div className="road-lines" aria-hidden="true">
          {[0,1,2,3,4].map(i => (
            <span key={i} className="road-dash" style={{'--d': i}} />
          ))}
        </div>
      </div>

      {/* ── Instagram watermark ── */}
      <a
        href="https://www.instagram.com/__abhishekpandey_/"
        target="_blank"
        rel="noopener noreferrer"
        className="insta-watermark"
        aria-label="Instagram @__abhishekpandey_"
      >
        <span>📷</span>
        <span>@__abhishekpandey_</span>
      </a>

      {/* ── Player + Indicator Lights ── */}
      <div className="player-wrapper">
        <IndLight isOn={indOn} />

        <section className="player-card" aria-label="Music player">
          <div className="player-card__glow-line" aria-hidden="true" />
          <div className="player-card__inner">

            {/* Track meta */}
            <div className="pc-meta">
              <span className="track-title">{activeSong?.song ?? '—'}</span>
              <span className="track-artist">{activeSong?.artist ?? '—'}</span>
            </div>

            {/* Controls */}
            <div className="pc-controls">
              <button className="ctrl-btn ctrl-sec" aria-label="Previous" onClick={handlePrev}>❮</button>
              <button className="ctrl-btn ctrl-play" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={handlePlayPause}>
                {isPlaying ? '❚❚' : '▶'}
              </button>
              <button className="ctrl-btn ctrl-sec" aria-label="Next" onClick={handleNext}>❯</button>
            </div>

            {/* Progress */}
            <div className="pc-progress">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }}>
                  <div className="progress-thumb" />
                </div>
              </div>
              <div className="progress-times">
                <span>{formatTime(currentTime)}</span>
                <span>{activeSong?.duration ?? formatTime(duration)}</span>
              </div>
            </div>

          </div>
        </section>

        <IndLight isOn={indOn} />
      </div>

      <audio ref={audioRef} preload="metadata" />
    </main>
  )
}

export default App
