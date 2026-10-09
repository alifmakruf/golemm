import { useState, useCallback, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import gsap from 'gsap'
import { EASE } from './gsap/eases.js'
import GolemHero from './components/GolemHero.jsx'
import SectionTwo from './components/SectionTwo.jsx'
import SectionThree from './components/SectionThree.jsx'
import SectionWhyUs from './components/SectionWhyUs.jsx'
import FrostVeil, { FROST_VEIL_CONFIG } from './components/FrostTransition.jsx'
import SectionPortfolio, { SHEET_TRANSITION_SEC } from './components/SectionPortfolio.jsx'
import SidebarNav from './components/SidebarNav.jsx'
import TerrainLoader, { SKY_COLOR } from './components/TerrainLoader.jsx'
import HeadlineModel, { HEADLINE_LAYER_HEIGHT_FRACTION } from './components/HeadlineModel.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import RippleDistortion from './components/RippleDistortion.jsx'
import './App.css'
import './perf.css' // override ringan khusus mobile (lihat isi file)

// ================== Parameter Tuning: Global App & Transisi ==================
// Anda dapat menyesuaikan parameter di bawah ini sesuka hati:

// 1. Parallax terrain & Headline:
// PARALLAX_TERRAIN        : intensitas gerak terrain berlawanan arah mouse (px)
// PARALLAX_HEADLINE       : intensitas gerak judul GOLEM (px) — lebih kecil agar tampak lebih dalam
// PARALLAX_LERP_SPEED     : kehalusan kelembaman kursor (0.04 = sangat fluid & luxury ala igloo, 0.2 = responsif tajam)
const PARALLAX_TERRAIN = 50
const PARALLAX_HEADLINE = 4
const PARALLAX_LERP_SPEED = 0.2

// 2. Durasi animasi fade out model 3D saat masuk ke Section 4 & 5 (website 2D)
// [SELARAS] Mengikuti durasi sheet putih (SHEET_TRANSITION_SEC di SectionPortfolio.jsx)
// supaya terrain memudar PERSIS selama sheet naik, bukan lebih cepat / lebih lambat.
const SHEET_TRANSITION_MS = SHEET_TRANSITION_SEC * 1000
const CANVAS_3D_FADEOUT_DURATION = `${SHEET_TRANSITION_SEC}s`

// 3. Tuning CSS Fog Overlay (kabut di lereng gunung)
// [OPTIMASI FPS] FOG_ENABLED: kabut ini berupa elemen 200% lebar layar dengan blur(40px) yang
// dianimasikan tanpa henti. Warnanya saat ini transparan penuh (alpha 0) — jadi tidak terlihat
// sama sekali tapi tetap memakan GPU tiap frame (paling terasa di HP). Aktifkan HANYA kalau
// FOG_COLOR diberi warna yang benar-benar terlihat.
const FOG_ENABLED = false
const FOG_COLOR = 'rgba(255, 255, 255, 0)'  // Warna kabut
const FOG_BLUR = 40                            // Gaussian blur radius (px)
const FOG_WIDTH = '200%'                       // Lebar kabut
const FOG_HEIGHT = '100%'                      // Tinggi kabut
const FOG_BOTTOM = '-25%'                      // Posisi vertikal dari bawah viewport
const FOG_DRIFT_DURATION = '1s'                // Kecepatan animasi kabut

// 4. Tuning RippleDistortion (efek riak air mengikuti kursor, lapisan PALING ATAS di semua section)
// Canvas transparan fixed seluruh layar (z-index RIPPLE_Z_INDEX), pointer-events: none => tidak mengganggu klik/scroll.
const RIPPLE_ENABLED = true                    // Aktifkan/nonaktifkan efek riak
const RIPPLE_Z_INDEX = 9999                    // Di atas semua section, Frost Veil, sheet 2D, & sidebar
const RIPPLE_BRUSH_SIZE = 70                   // Diameter tiap riak (px)
const RIPPLE_STRENGTH = 0.1                    // Dorongan distorsi gambar
const RIPPLE_SWIRL = 1                         // Putaran arah dorongan; 0 = datar, makin tinggi makin berlipat
const RIPPLE_RINGS = 0                         // Jumlah cincin gelombang di tiap riak (0 = satu blob polos)
const RIPPLE_SPREAD = 1.25                     // Seberapa kali ukuran awal riak membesar sebelum hilang
const RIPPLE_FADE = 1.2                        // Lama riak bertahan (detik)
const RIPPLE_SPACING = 0                       // Jarak gerak kursor antar riak (px) — makin besar jejak makin jarang
const RIPPLE_GLINT = 0.1                         // Kilau di bahu riak (0 = mati)
const RIPPLE_TINT = 'transparent'                  // Warna air (ungu)
const RIPPLE_HIGHLIGHT = 'transparent'             // Warna kilau
const RIPPLE_OPACITY = 0.1                       // Kepekatan maksimum riak (0–1). 1 = gambar tampil penuh di pusat riak
const RIPPLE_TRIGGER = 'hover'                 // 'hover' | 'click' | 'both'
const RIPPLE_CLICK_STRENGTH = 2                // Riak klik dimulai sekian kali lebih besar dari riak hover
const RIPPLE_QUALITY = 'high'                   // 'low' | 'medium' | 'high' — resolusi buffer displacement
const RIPPLE_DISPERSION = 0                     // Pemisahan kanal merah/biru (hanya berlaku bila RIPPLE_SRC diisi)
const RIPPLE_TINT_AMOUNT = 0                 // Kekuatan tint pada gambar (hanya berlaku bila RIPPLE_SRC diisi)
const RIPPLE_GRAYSCALE = true                  // Gambar jadi hitam-putih (hanya berlaku bila RIPPLE_SRC diisi)
const RIPPLE_SRC = undefined                 // Gambar yang tampil terdistorsi DI DALAM riak (taruh file di public/hero.jpg). undefined = riak polos berwarna tint

// ================== Parameter Tuning: Headline Belakang Terrain ==================
// Headline sekarang berupa model 3D (textgolem.glb) menggantikan teks "GOLEM".
// Semua parameter model (path file, scale, posisi, rotasi, kamera, lighting)
// ada di src/components/HeadlineModel.jsx — cari komentar "Tuning" di sana.
const HEADLINE_RETURN_DELAY_MS = 600           // Jeda waktu (ms) sebelum headline muncul kembali saat kembali ke Section 1
const HEADLINE_ENTRANCE_DURATION = 0.85        // Durasi masuk headline (detik)
const HEADLINE_EXIT_DURATION = 0.65            // Durasi keluar headline (detik)

// 5. Navigasi Scroll (menggantikan tombol Next/Back manual di Section 2 & 3)
const SCROLL_NAV_COOLDOWN_MS = 500      // Jeda minimum antar perpindahan section via scroll/swipe
const SCROLL_WHEEL_THRESHOLD = 35       // Ambang deltaY scroll mouse/trackpad supaya dianggap "niat pindah"
const SWIPE_THRESHOLD_PX = 1           // Jarak minimum swipe layar sentuh (px) supaya dianggap "niat pindah"

// 6. Frost Veil (Section 3 <-> 3.5)
// Lembar es naik/turun menutupi layar (konsep sama dengan sheet Section 4), section diganti saat tertutup.
// Transisi DIGERAKKAN SCROLL: posisi kabut mengikuti jarak scroll/swipe. Saat scroll berhenti, threshold
// (commitThreshold) menentukan dilanjutkan atau dibatalkan. Semua pengaturan ada di FROST_VEIL_CONFIG (FrostTransition.jsx).
const FROST_GESTURE_GAP_MS = 140   // Jeda tenang antar event wheel agar dianggap gesture BARU (tolak ekor inersia)
const FROST_TOUCH_DEADZONE_PX = 1  // Geseran jari minimum (px) sebelum kabut mulai bergerak
// [PERFORMA] Saat lembar 3.5 sudah menutupi sebagian besar layar, terrain 3D di belakangnya DIBEKUKAN (tidak dirender)
// supaya GPU tidak merender 2 canvas WebGL + bloom sekaligus (penyebab patah-patah di kisaran 50%+).
// Nilai = posisi tepi atas lembar (vh dari atas layar). 100 = lembar baru mulai muncul, 0 = menutup penuh.
// Makin BESAR = terrain dibekukan lebih awal (lebih ringan, tapi salju di belakang berhenti lebih cepat).
const FROST_PAUSE_TERRAIN_BELOW_VH = 85

// 9. [BARU] Section 4/5 -> kembali ke 3.5 lewat scroll ke atas
// Dulu SATU tick wheel saat sheet berada di atas langsung membuang sheet (termasuk sisa
// inersia dari scroll ke atas barusan). Sekarang butuh: (a) sheet sudah diam di atas
// minimal SHEET_EXIT_COOLDOWN_MS, dan (b) dorongan ke atas terakumulasi >= SHEET_EXIT_ACCUM_PX.
const SHEET_EXIT_COOLDOWN_MS = 420
const SHEET_EXIT_ACCUM_PX = 140

// 10. [PARAMETER] Stacking Context & Interaksi Section 3
// SECTION_3_WRAPPER_Z_INDEX : z-index kontainer Section 3 (tetap 4 agar berada di bawah lembar Section 3.5).
// Kontainer ini diberi pointerEvents kondisional agar saat berada di Section 1 (Hero) atau section lainnya,
// kontainer tidak menghalangi event klik/tap ke tombol Hero ("Jelajahi Sekarang").
const SECTION_3_WRAPPER_Z_INDEX = 4

export default function App() {
  const [isLoadingComplete, setIsLoadingComplete] = useState(false)
  const [activeSection, setActiveSection] = useState(1)

  // Frost transition state
  // frostPhase: 'none' | 'entering' (3→3.5) | 'exiting' (3.5→4) | 'inside' (di dalam 3.5, frost mencair)
  // frostStep: 0..IN_LAST_STEP (entering) atau 0..OUT_LAST_STEP (exiting)
  const [frostPhase, setFrostPhase] = useState('none')
  const [veilCovered, setVeilCovered] = useState(false)   // true = lembar sudah menutupi cukup luas => terrain dibekukan
  const veilCoveredRef = useRef(false)
  const frostCancelTimerRef = useRef(null)  // timer unmount frost (cadangan)
  const transitionLockRef = useRef(false)   // true selama transisi frost 3 <-> 3.5 <-> 4 berjalan penuh
  const transitionTimersRef = useRef([])
  const lastWheelTimeRef = useRef(0)
  const whyUsEntryRef = useRef('above')     // 'above' = datang dari Section 3, 'below' = kembali dari Section 4
  const sheetLastScrollAtRef = useRef(0)    // kapan terakhir sheet 2D tidak berada di paling atas
  const sheetExitAccumRef = useRef(0)       // akumulasi dorongan ke atas saat sheet sudah di paling atas
  const touchGestureStartYRef = useRef(null)    // Y awal SATU gesture sentuh (touchStartYRef di-reset tiap move)
  const touchStartScrollTopRef = useRef(0)      // scrollTop sheet saat jari menyentuh

  const { active, progress } = useProgress()
  const timerRef = useRef(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960

  // Refs imperative ke Section 2 & 3 (untuk memicu animasi keluar yang sama
  // seperti tombol Next/Back lama, dipanggil dari handler scroll di bawah)
  const section2Ref = useRef(null)
  const section3Ref = useRef(null)
  const sectionWhyUsRef = useRef(null)
  const scrollLockRef = useRef(false)   // true selama transisi section berjalan (cegah trigger dobel)
  const touchStartYRef = useRef(null)

  // Refs untuk elemen DOM
  const fogRef = useRef(null)
  const headlineLayerRef = useRef(null)
  const terrainLayerRef = useRef(null)
  const terrainWrapperRef = useRef(null)
  // Ref wrapper Section 3 & filter Heat Haze (imperiatif, zero React state)
  const frostRef = useRef(null)
  const frostScrubRef = useRef(null)          // arah gesture kabut yang sedang berjalan ('up' | 'down') atau null
  const frostReleaseTimerRef = useRef(null)   // timer "scroll berhenti" => release kabut (wheel)
  const frostWatchdogRef = useRef(null)       // pengaman: buka kunci bila transisi kabut macet

  // Nilai posisi mouse untuk Parallax via RequestAnimationFrame (Zero Re-render)
  const mouseTargetRef = useRef({ x: 0, y: 0 })
  const mouseCurrentRef = useRef({ x: 0, y: 0 })
  const rafIdRef = useRef(null)
  const headlineEntranceDoneRef = useRef(false)

  // Status perpindahan section untuk Headline
  const isHeadlineExiting = activeSection >= 2
  const prevHeadlineExiting = useRef(isHeadlineExiting)

  // Mouse move handler: hanya update target koordinat ref, TANPA pemicu re-render React!
  const handleMouseMove = useCallback((e) => {
    const px = (e.clientX / window.innerWidth - 0.5) * 2
    const py = (e.clientY / window.innerHeight - 0.5) * 2
    mouseTargetRef.current.x = px
    mouseTargetRef.current.y = py
  }, [])

  // ============================================================================
  // Frost Veil Section 3 <-> 3.5 — DIGERAKKAN SCROLL (hanya transform => ringan).
  // 'up'   = 3 -> 3.5 (lembar naik dari bawah); 'down' = 3.5 -> 3 (lembar turun dari atas).
  // Alur: startFrostScrub (mulai) -> pushFrostScrub (tiap scroll/swipe) -> releaseFrostScrub
  // (scroll berhenti / jari diangkat; threshold menentukan lanjut atau batal).
  // Section 3.5 adalah LEMBAR yang menimpa Section 3 (kabut = tepi atasnya); activeSection baru diganti saat gesture selesai.
  // Selama gesture frostPhase != 'none' -> CSS mematikan backdrop-filter kartu & fluid cursor dijeda.
  // ============================================================================
  const releaseFrostScrub = useCallback(() => {
    clearTimeout(frostReleaseTimerRef.current)
    if (!frostScrubRef.current || !frostRef.current) return
    frostScrubRef.current = null   // input berikutnya diabaikan (transitionLockRef masih true) sampai selesai
    frostRef.current.release()
    // Pengaman: transisi paling lama ~2.2 detik. Bila 6 detik kemudian kunci masih menyala (animasi macet),
    // paksa buka kunci supaya scroll tidak terkunci selamanya.
    clearTimeout(frostWatchdogRef.current)
    frostWatchdogRef.current = setTimeout(() => {
      if (transitionLockRef.current && !frostScrubRef.current && frostRef.current) {
        // [FIX] abort() memanggil onDone(false) sehingga lock, phase & lembar kembali konsisten
        if (frostRef.current.isActive()) frostRef.current.abort()
        else frostRef.current.kill()
        transitionLockRef.current = false
        frostScrubRef.current = null
        setFrostPhase('none')
      }
    }, 6000)
  }, [])

  // Kabut DIAM di posisinya saat input berhenti; baru setelah settleDelayMs tanpa input, threshold menentukan lanjut/batal.
  const scheduleFrostRelease = useCallback(() => {
    clearTimeout(frostReleaseTimerRef.current)
    frostReleaseTimerRef.current = setTimeout(releaseFrostScrub, FROST_VEIL_CONFIG.settleDelayMs)
  }, [releaseFrostScrub])

  const startFrostScrub = useCallback((direction) => {
    if (transitionLockRef.current || !frostRef.current) return false
    transitionLockRef.current = true
    frostScrubRef.current = direction
    veilCoveredRef.current = false
    setVeilCovered(false)
    // [FIX] Watchdog dari gesture sebelumnya tidak boleh "membunuh" gesture baru
    clearTimeout(frostWatchdogRef.current)
    clearTimeout(frostReleaseTimerRef.current)
    if (direction === 'up') whyUsEntryRef.current = 'above'   // 3.5 selalu mulai dari konten pertama saat datang dari Section 3
    setFrostPhase(direction === 'up' ? 'entering' : 'returning')
    frostRef.current.begin(direction, {
      // Lembar Section 3.5 digeser mengikuti scroll; kabut menyatu di tepi atasnya
      onSheet: (yVh) => {
        sectionWhyUsRef.current?.setSheetY(yVh)
        // Hanya setState saat melewati ambang (bukan tiap frame) => nol re-render berlebih
        const covered = yVh < FROST_PAUSE_TERRAIN_BELOW_VH
        if (covered !== veilCoveredRef.current) {
          veilCoveredRef.current = covered
          setVeilCovered(covered)
        }
      },
      onDone: (committed, instant) => {
        // [FIX] Gesture SELESAI: bersihkan semua sisa state. Sebelumnya frostScrubRef & watchdog tidak
        // dibersihkan di jalur 'completing' (scroll sampai 100%), sehingga event wheel pertama di 3.5 termakan
        // dan watchdog basi (6 dtk) bisa mematikan gesture berikutnya di tengah jalan.
        clearTimeout(frostReleaseTimerRef.current)
        clearTimeout(frostWatchdogRef.current)
        frostScrubRef.current = null
        // Section baru diganti di sini (lembar sudah menutup penuh / sudah menyingkap penuh)
        if (committed) {
          if (direction === 'up') {
            whyUsEntryRef.current = 'above'
            setActiveSection(3.5)
          } else {
            setActiveSection(3)
          }
        }
        veilCoveredRef.current = false
        setVeilCovered(false)
        setFrostPhase('none')
        transitionLockRef.current = false
        // Kunci singkat agar sisa inersia scroll tidak langsung memicu pindah lagi
        // (tidak dipakai saat gesture dibatalkan seketika oleh scroll berlawanan arah — user ingin langsung scroll)
        if (!instant) {
          scrollLockRef.current = true
          setTimeout(() => { scrollLockRef.current = false }, SCROLL_NAV_COOLDOWN_MS)
        }
      },
    })
    return true
  }, [])

  // amount = jarak input dalam px; POSITIF = scroll ke bawah / swipe ke atas (arah "maju"), NEGATIF = sebaliknya.
  // Arah 'up' bergerak oleh amount positif, arah 'down' oleh amount negatif; input berlawanan menarik kabut balik.
  // Mengembalikan false bila gesture kabut ditutup seketika (scroll berlawanan arah saat kabut sudah di titik awal):
  // pemanggil lalu meneruskan input yang sama ke section seperti biasa (goBack di Section 3 / scroll konten di 3.5).
  const pushFrostScrub = useCallback((amount) => {
    const dir = frostScrubRef.current
    if (!dir || !frostRef.current) return false
    const isTouch = touchGestureStartYRef.current != null   // jari sedang menyentuh layar
    const distance = isTouch ? FROST_VEIL_CONFIG.touchDistancePx : FROST_VEIL_CONFIG.scrollDistancePx
    const res = frostRef.current.push((dir === 'up' ? amount : -amount) / distance)
    if (res === false) {
      clearTimeout(frostReleaseTimerRef.current)
      frostScrubRef.current = null
      return false
    }
    if (res === 'completing') {
      clearTimeout(frostReleaseTimerRef.current)
      return true
    }
    if (res === 'committed') {
      // [FIX] Transisi selesai di event ini. Event TIDAK boleh diteruskan ke handler section: closure handler masih
      // memegang activeSection LAMA (React belum re-render), jadi dulu event yang sama memulai gesture baru
      // (3->3.5 lalu langsung "naik lagi", atau 3.5->3 lalu langsung "terlempar" balik ke 3.5).
      clearTimeout(frostReleaseTimerRef.current)
      frostScrubRef.current = null
      return true
    }
    // Wheel tidak punya "event selesai": anggap berhenti bila tidak ada event baru.
    // (Untuk touch, jeda dimulai saat jari diangkat — lihat onTouchEnd.)
    if (!isTouch) scheduleFrostRelease()
    return true
  }, [scheduleFrostRelease])

  // Jalan otomatis penuh (tanpa scroll user): untuk pemanggilan programatik (tombol/keyboard/ref)
  const playFrost = useCallback((direction) => {
    if (!startFrostScrub(direction)) return
    frostRef.current.push(1)
    releaseFrostScrub()
  }, [startFrostScrub, releaseFrostScrub])

  const returnToSection3 = useCallback(() => playFrost('down'), [playFrost])

  // Parallax animation loop ber-lerp (inertial damping) yang fluid 60-120 FPS
  useEffect(() => {
    if (isMobile) return

    const tick = () => {
      const targetX = mouseTargetRef.current.x
      const targetY = mouseTargetRef.current.y

      // Lerp smoothing formula
      mouseCurrentRef.current.x += (targetX - mouseCurrentRef.current.x) * PARALLAX_LERP_SPEED
      mouseCurrentRef.current.y += (targetY - mouseCurrentRef.current.y) * PARALLAX_LERP_SPEED

      const cx = mouseCurrentRef.current.x
      const cy = mouseCurrentRef.current.y

      // Terapkan langsung ke transform terrain wrapper
      if (terrainWrapperRef.current) {
        terrainWrapperRef.current.style.transform = `translate3d(${cx * -PARALLAX_TERRAIN}px, ${cy * -PARALLAX_TERRAIN}px, 0)`
      }

      // Terapkan ke headline jika entrance sudah selesai
      if (headlineLayerRef.current && headlineEntranceDoneRef.current && !isHeadlineExiting) {
        headlineLayerRef.current.style.transform = `translate3d(${cx * -PARALLAX_HEADLINE}px, ${cy * -PARALLAX_HEADLINE}px, 0)`
      }

      rafIdRef.current = requestAnimationFrame(tick)
    }

    rafIdRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    }
  }, [isMobile, isHeadlineExiting])

  // GSAP Headline: Kontrol entrance dan exit secara bersih tanpa bentrok CSS !important
  useEffect(() => {
    if (!isLoadingComplete || !headlineLayerRef.current) return

    if (isHeadlineExiting) {
      headlineEntranceDoneRef.current = false
      gsap.to(headlineLayerRef.current, {
        opacity: 0,
        y: -120,
        duration: HEADLINE_EXIT_DURATION,
        ease: EASE.softOut2,
        overwrite: true,
      })
    } else if (prevHeadlineExiting.current) {
      // Re-enter saat kembali ke Section 1
      headlineEntranceDoneRef.current = false
      gsap.fromTo(
        headlineLayerRef.current,
        { opacity: 0, y: -80 },
        {
          opacity: 1,
          y: 0,
          delay: HEADLINE_RETURN_DELAY_MS / 1000,
          duration: HEADLINE_ENTRANCE_DURATION,
          ease: EASE.softOut2,
          overwrite: true,
          onComplete: () => {
            headlineEntranceDoneRef.current = true
          },
        }
      )
    } else {
      // First initial entrance langsung saat aset selesai loading
      gsap.fromTo(
        headlineLayerRef.current,
        { opacity: 0, y: -80 },
        {
          opacity: 1,
          y: 0,
          delay: 0.25,
          duration: HEADLINE_ENTRANCE_DURATION,
          ease: EASE.softOut2,
          onComplete: () => {
            headlineEntranceDoneRef.current = true
          },
        }
      )
    }

    prevHeadlineExiting.current = isHeadlineExiting
  }, [isHeadlineExiting, isLoadingComplete])

  // GSAP — Kabut lereng gunung
  useEffect(() => {
    if (!FOG_ENABLED || !fogRef.current) return
    const duration = activeSection === 2 ? 4.5 : 1
    gsap.fromTo(
      fogRef.current,
      { xPercent: -53 },
      { xPercent: -47, duration, ease: EASE.easeInOut, yoyo: true, repeat: -1, overwrite: true }
    )
  }, [activeSection])

  // ============================================================
  // GSAP — Fade-in terrain 3D saat loading selesai
  // (dulunya: class "animate-fade-in-up" -> @keyframes fadeInTerrain)
  // ============================================================
  useEffect(() => {
    if (!terrainLayerRef.current) return
    if (isLoadingComplete) {
      gsap.fromTo(
        terrainLayerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1.2, ease: EASE.easeOut }
      )
    } else {
      gsap.set(terrainLayerRef.current, { opacity: 0 })
    }
  }, [isLoadingComplete])

  // Sembunyikan loading screen saat aset selesai dimuat
  useEffect(() => {
    if (!active && progress === 100 && !isLoadingComplete) {
      timerRef.current = setTimeout(() => setIsLoadingComplete(true), 200)
    }
    return () => clearTimeout(timerRef.current)
  }, [active, progress, isLoadingComplete])

  // Handler pemilihan section dari Sidebar Nav burger menu
  // Kunci sementara supaya satu gesture scroll/swipe hanya memicu SATU
  // perpindahan section, walau event wheel/touch terus menerus datang selama
  // animasi transisi berjalan.
  const lockNav = useCallback(() => {
    scrollLockRef.current = true
    setTimeout(() => {
      scrollLockRef.current = false
    }, SCROLL_NAV_COOLDOWN_MS)
  }, [])

  // ============================================================
  // NAVIGASI SCROLL — menggantikan tombol Next/Back manual.
  // Section 1->2->3 dipicu via ref imperative (next/back) supaya animasi
  // keluar Section 2 & 3 yang sudah ada (card meluncur turun dll) tetap
  // jalan persis seperti saat tombolnya masih ada. Section 3->4 memakai
  // jalur yang sama (section3Ref.next() memanggil onNext -> setActiveSection(4)).
  // Section 4/5 (sheet 2D) discroll biasa lewat browser; hanya saat sheet
  // berada TEPAT di paling atas dan user scroll ke ATAS lagi, itu dianggap
  // sebagai niat "kembali ke 3D" (activeSection 3).
  // ============================================================
  useEffect(() => () => {
    transitionTimersRef.current.forEach(clearTimeout)
    clearTimeout(frostCancelTimerRef.current)
    clearTimeout(frostReleaseTimerRef.current)
    clearTimeout(frostWatchdogRef.current)
    if (frostRef.current) frostRef.current.kill()
  }, [])

  const goNext = useCallback(() => {
    if (scrollLockRef.current || transitionLockRef.current) return

    if (activeSection === 3.5) return // Scroll sudah didelegasikan ke SectionWhyUs

    if (activeSection === 1) {
      lockNav()
      setActiveSection(2)
    } else if (activeSection === 2 && section2Ref.current) {
      lockNav()
      section2Ref.current.next()
    } else if (activeSection === 3) {
      // Maju di Section 3: jalankan Frost Veil ke Section 3.5
      playFrost('up')
    }
  }, [activeSection, lockNav, playFrost])

  // Kembali dari sheet 2D (Section 4/5) ke Section 3.5. Datang dari BAWAH, jadi 3.5
  // dibuka langsung di konten terakhir ("Hand To Hand"), bukan loncat ke Golem di awal.
  const backFromSheet = useCallback(() => {
    if (transitionLockRef.current) return
    whyUsEntryRef.current = 'below'
    setActiveSection(3.5)
    transitionLockRef.current = true
    const t = setTimeout(() => { transitionLockRef.current = false }, SHEET_TRANSITION_MS * 0.6)
    transitionTimersRef.current.push(t)
  }, [])

  const goBack = useCallback(() => {
    if (scrollLockRef.current || transitionLockRef.current) return

    if (activeSection === 3.5) {
      returnToSection3()
      return
    }

    if (activeSection === 2 && section2Ref.current) {
      lockNav()
      section2Ref.current.back()
    } else if (activeSection === 3 && section3Ref.current) {
      lockNav()
      section3Ref.current.back()
    } else if (activeSection === 4 || activeSection === 5) {
      lockNav()
      backFromSheet()
    }
  }, [activeSection, lockNav, returnToSection3, backFromSheet])

  // Section 2 & 3 kadang isinya lebih tinggi dari layar di HP (card-card jadi
  // ditumpuk vertikal), sehingga container-nya punya scroll internal sendiri
  // (lihat overflow-y:auto di CSS masing-masing pada breakpoint mobile).
  // Helper ini mengecek apakah container tsb sudah mentok atas/bawah —
  // dipakai supaya swipe/scroll HANYA memicu pindah section saat pembaca
  // benar-benar sudah sampai ujung, bukan di tengah membaca isi section.
  // Di desktop (tanpa overflow, scrollHeight === clientHeight) hasilnya
  // selalu "sudah mentok kedua sisi", sehingga perilaku lama (langsung
  // pindah) tetap seperti semula.
  const getScrollBoundary = (selector) => {
    const el = document.querySelector(selector)
    if (!el) return { atTop: true, atBottom: true }
    const atTop = el.scrollTop <= 1
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
    return { atTop, atBottom }
  }

  const SCROLLABLE_SECTION_SELECTOR = { 2: '.section-two', 3: '.section-three', 3.5: '.section-why-us' }

  // Sheet 2D baru "tiba" di Section 4/5 -> beri jeda sebelum scroll ke atas boleh membuangnya
  useEffect(() => {
    if (activeSection >= 4) {
      sheetLastScrollAtRef.current = performance.now() + SHEET_TRANSITION_MS * 0.5
      sheetExitAccumRef.current = 0
    }
  }, [activeSection])

  // Wheel (mouse/trackpad desktop)
  useEffect(() => {
    if (!isLoadingComplete) return

    const onWheel = (e) => {
      // Catat waktu event wheel terakhir (dipakai gesture-gate Section 3, 3.5 & sheet 2D)
      const now = performance.now()
      const quietGap = now - lastWheelTimeRef.current
      lastWheelTimeRef.current = now
      // Event wheel = tidak ada jari di layar. Bersihkan sisa status sentuh (touchend yang tidak sampai) supaya
      // gesture kabut dari wheel SELALU dapat timer "scroll berhenti" dan tidak menggantung.
      touchGestureStartYRef.current = null
      touchStartYRef.current = null

      // Gesture kabut sedang berjalan: SEMUA wheel menggerakkan kabut (maju / ditarik balik)
      if (frostScrubRef.current) {
        e.preventDefault()
        if (pushFrostScrub(e.deltaY) !== false) return
        // false = gesture kabut ditutup (scroll berlawanan di titik awal): lanjut diproses normal di bawah
      }

      // Section 3.5: delegasikan langsung ke SectionWhyUs (scroll internal content + overshoot exit)
      if (activeSection === 3.5) {
        e.preventDefault()
        // [FIX] Dulu: `lock && frostScrubRef` -> saat kabut sedang menetap/membatalkan (frostScrubRef sudah null)
        // wheel bocor ke konten 3.5. Selama lock aktif, SEMUA input konten harus ditahan.
        if (transitionLockRef.current) return
        sectionWhyUsRef.current?.onWheelDelta(e.deltaY)
        return
      }

      // SECTION 3: scroll ke bawah menggerakkan kabut ke 3.5 (dilanjutkan bila melewati threshold); ke atas = kembali ke Section 2.
      // Ekor inersia dari gesture sebelumnya (mis. dari Section 2) ditolak lewat "gerbang gesture".
      if (activeSection === 3) {
        e.preventDefault()
        if (transitionLockRef.current || scrollLockRef.current) return
        const strong = Math.abs(e.deltaY) >= SCROLL_WHEEL_THRESHOLD
        const fresh = quietGap > FROST_GESTURE_GAP_MS
        if (!strong && !fresh) return
        if (e.deltaY > 0) {
          if (startFrostScrub('up')) pushFrostScrub(e.deltaY)
        } else if (strong) goBack()
        return
      }

      // Section 4/5 (sheet 2D): scroll normal di dalam sheet. Saat sudah di paling atas dan user
      // MEMANG mendorong ke atas (bukan sisa inersia), baru kembali ke 3D.
      if (activeSection === 4 || activeSection === 5) {
        const sheet = document.querySelector('.portfolio-page-2d')
        if (!sheet) return
        if (sheet.scrollTop > 0) {
          sheetLastScrollAtRef.current = now
          sheetExitAccumRef.current = 0
          return
        }
        if (e.deltaY < 0) {
          e.preventDefault()
          if (now - sheetLastScrollAtRef.current < SHEET_EXIT_COOLDOWN_MS) return
          if (quietGap > 300) sheetExitAccumRef.current = 0
          sheetExitAccumRef.current += -e.deltaY
          if (sheetExitAccumRef.current >= SHEET_EXIT_ACCUM_PX) {
            sheetExitAccumRef.current = 0
            goBack()
          }
        } else {
          sheetExitAccumRef.current = 0
        }
        return
      }

      if (Math.abs(e.deltaY) < SCROLL_WHEEL_THRESHOLD) return

      if (activeSection === 1) {
        // Hero: tidak ada scroll internal, scroll SELALU berarti pindah section.
        e.preventDefault()
        if (e.deltaY > 0) goNext()
        return
      }

      const selector = SCROLLABLE_SECTION_SELECTOR[activeSection]
      if (selector) {
        const { atTop, atBottom } = getScrollBoundary(selector)
        if (e.deltaY > 0 && atBottom) {
          e.preventDefault()
          goNext()
        } else if (e.deltaY < 0 && atTop) {
          e.preventDefault()
          goBack()
        }
        // Selain itu: biarkan scroll native jalan di dalam section (belum mentok).
      }
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [isLoadingComplete, activeSection, goNext, goBack, startFrostScrub, pushFrostScrub])

  // Swipe & Touch Drag (layar sentuh mobile)
  useEffect(() => {
    if (!isLoadingComplete) return

    const onTouchStart = (e) => {
      const y = e.touches[0]?.clientY ?? null
      touchStartYRef.current = y
      touchGestureStartYRef.current = y
      // Jari menyentuh lagi saat kabut sedang diam: batalkan hitung mundur, lanjutkan menggeser
      if (frostScrubRef.current) clearTimeout(frostReleaseTimerRef.current)
      const sheet = document.querySelector('.portfolio-page-2d')
      touchStartScrollTopRef.current = sheet ? sheet.scrollTop : 0
    }

    const onTouchMove = (e) => {
      if (touchStartYRef.current == null) return
      const currentY = e.touches[0]?.clientY
      if (currentY == null) return
      const dy = touchStartYRef.current - currentY
      touchStartYRef.current = currentY

      // Gesture kabut sedang berjalan: jari menggerakkan kabut (maju / ditarik balik)
      if (frostScrubRef.current) {
        if (e.cancelable) e.preventDefault()
        if (pushFrostScrub(dy) !== false) return
        // false = gesture kabut ditutup: lanjut diproses normal di bawah
      }

      // Section 3.5: delegasikan ke SectionWhyUs
      if (activeSection === 3.5) {
        if (e.cancelable) e.preventDefault()
        if (!transitionLockRef.current) sectionWhyUsRef.current?.onTouchDelta(dy)   // [FIX] sama seperti wheel
        return
      }

      // Section 3: geser jari ke atas menggerakkan kabut; swipe turun (kembali ke Section 2) diputuskan saat jari diangkat
      if (activeSection === 3) {
        if (e.cancelable) e.preventDefault()
        const total = (touchGestureStartYRef.current ?? currentY) - currentY   // positif = jari bergerak naik
        if (!transitionLockRef.current && !scrollLockRef.current && total > FROST_TOUCH_DEADZONE_PX) {
          if (startFrostScrub('up')) pushFrostScrub(total)
        }
      }
    }

    const onTouchEnd = (e) => {
      // [PERBAIKAN] Pakai Y AWAL gesture (bukan Y terakhir yang di-reset tiap touchmove).
      // Sebelumnya dy di sini nyaris selalu ~0 sehingga swipe pindah section tidak pernah terpicu.
      const startY = touchGestureStartYRef.current
      touchGestureStartYRef.current = null
      touchStartYRef.current = null

      // Jari diangkat saat kabut bergerak: threshold menentukan lanjut atau batal
      if (frostScrubRef.current) {
        scheduleFrostRelease()
        return
      }
      if (startY == null) return
      const endY = e.changedTouches[0]?.clientY ?? startY
      const dy = startY - endY // positif = swipe ke atas (niat maju)

      // Section 3.5: touch end → reset overshoot di SectionWhyUs
      if (activeSection === 3.5) {
        sectionWhyUsRef.current?.onTouchEnd()
        return
      }

      // Section 3: swipe turun = kembali ke Section 2 (swipe naik sudah ditangani kabut di atas)
      if (activeSection === 3) {
        if (dy <= -SWIPE_THRESHOLD_PX) goBack()
        return
      }

      if (Math.abs(dy) < SWIPE_THRESHOLD_PX) return

      if (activeSection === 1) {
        if (dy > 0) goNext()
        return
      }

      const selector = SCROLLABLE_SECTION_SELECTOR[activeSection]
      if (selector) {
        const { atTop, atBottom } = getScrollBoundary(selector)
        if (dy > 0 && atBottom) goNext()
        else if (dy < 0 && atTop) goBack()
        return
      }

      if (activeSection === 4 || activeSection === 5) {
        // Hanya bila jari MULAI menyentuh saat sheet sudah di paling atas
        // (bukan flick yang kebetulan berakhir di atas karena momentum scroll).
        const sheet = document.querySelector('.portfolio-page-2d')
        if (sheet && dy < 0 && sheet.scrollTop <= 0 && touchStartScrollTopRef.current <= 1) goBack()
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [isLoadingComplete, activeSection, goNext, goBack, startFrostScrub, pushFrostScrub, scheduleFrostRelease])

  // Handler navigasi dari SidebarNav & TopNav
  const handleSelectSection = useCallback((secId) => {
    // Batalkan transisi frost yang sedang berjalan supaya timer lama tidak menimpa pilihan ini
    transitionTimersRef.current.forEach(clearTimeout)
    transitionTimersRef.current = []
    clearTimeout(frostCancelTimerRef.current)
    clearTimeout(frostReleaseTimerRef.current)
    clearTimeout(frostWatchdogRef.current)
    frostScrubRef.current = null
    if (frostRef.current) frostRef.current.kill()
    transitionLockRef.current = false

    // [PERBAIKAN] Dulu mask Section 3 yang tertinggal (progress 1.0) tidak pernah dibersihkan,
    // sehingga memilih "Section 3" lewat sidebar setelah mengunjungi 3.5 menampilkan layar KOSONG
    // dan progress gelombang tetap 1.0. Sekarang state gelombang selalu disinkronkan.
    whyUsEntryRef.current = 'above'
    setFrostPhase('none')
    setActiveSection(secId)
    if (secId === 4) {
      setTimeout(() => {
        const el = document.getElementById('section-4')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 150)
    } else if (secId === 5) {
      setTimeout(() => {
        const el = document.getElementById('section-5')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 150)
    }
  }, [])

  const is2DMode = activeSection >= 4 // Section 4 & 5 beralih ke website 2D
  const isSection35 = activeSection === 3.5

  // [OPTIMASI FPS] Saat Section 4 & 5 (sheet putih menutupi layar), canvas terrain sudah
  // transparan (fade out) tapi dulu tetap dirender penuh tiap frame di belakang sheet.
  // Sekarang render loop-nya dihentikan setelah fade-out selesai, lalu dilanjutkan
  // begitu kembali ke Section 3.
  const [terrainPaused, setTerrainPaused] = useState(false)
  useEffect(() => {
    if (!is2DMode) {
      setTerrainPaused(false)
      return undefined
    }
    const t = setTimeout(
      () => setTerrainPaused(true),
      parseFloat(CANVAS_3D_FADEOUT_DURATION) * 1000 + 150
    )
    return () => clearTimeout(t)
  }, [is2DMode])

  // [SELARAS] Untuk terrain, Section 3.5 diperlakukan sama dengan Section 3: kamera, cahaya, salju
  // & kunang-kunang TETAP di keadaan Section 3 selama berada di 3.5 (canvas terrain memang dihentikan).
  // Jadi saat gelombang menyapu balik 3.5 -> 3, latar di belakang kartu sama persis dengan sebelum
  // gelombang masuk — tidak ada "lonjakan" kamera/cahaya saat Section 3 tersibak lagi.
  const terrainSection = isSection35 ? 3 : activeSection
  const terrainFrameloop = (terrainPaused || (isSection35 && frostPhase !== 'returning') || (veilCovered && frostPhase !== 'none')) ? 'never' : 'always'

  const headlineClass = isHeadlineExiting ? 'app-headline-layer--exiting' : ''

  return (
    <div
      className={`app-container ${activeSection === 1 ? 'app-container--hero' : ''}`}
      data-wave={frostPhase}
      onMouseMove={!isMobile ? handleMouseMove : undefined}
    >
      {/* Loading Screen */}
      {!isLoadingComplete && <LoadingScreen progress={progress} />}

      {/* RippleDistortion: riak air mengikuti kursor (desktop only, skip di mobile).
          Lapisan overlay transparan di PALING ATAS semua section (z-index RIPPLE_Z_INDEX), aktif terus
          di Section 1–5 termasuk saat Frost Veil & sheet 2D. Saat tidak ada riak aktif, komponen
          berhenti merender (nol beban GPU), jadi tidak bersaing dengan terrain 3D. */}
      {isLoadingComplete && !isMobile && RIPPLE_ENABLED && (
        <RippleDistortion
          overlay
          zIndex={RIPPLE_Z_INDEX}
          src={RIPPLE_SRC}
          brushSize={RIPPLE_BRUSH_SIZE}
          strength={RIPPLE_STRENGTH}
          swirl={RIPPLE_SWIRL}
          rings={RIPPLE_RINGS}
          spread={RIPPLE_SPREAD}
          fade={RIPPLE_FADE}
          spacing={RIPPLE_SPACING}
          dispersion={RIPPLE_DISPERSION}
          tintAmount={RIPPLE_TINT_AMOUNT}
          grayscale={RIPPLE_GRAYSCALE}
          glint={RIPPLE_GLINT}
          tint={RIPPLE_TINT}
          highlightColor={RIPPLE_HIGHLIGHT}
          overlayOpacity={RIPPLE_OPACITY}
          trigger={RIPPLE_TRIGGER}
          clickStrength={RIPPLE_CLICK_STRENGTH}
          quality={RIPPLE_QUALITY}
        />
      )}

      {/* New Sidebar Burger Navigation (Fixed di Pojok Kanan Atas 1-5) */}
      {isLoadingComplete && (
        <SidebarNav
          activeSection={activeSection}
          onSelectSection={handleSelectSection}
        />
      )}

      {/* Sky Layer (BARU): warna langit statis, paling belakang dari semua layer visual.
          Sebelumnya warna ini di-set sebagai scene.background di dalam Canvas
          (TerrainLoader), sehingga Canvas jadi opaque dan menutupi apapun di
          belakangnya. Sekarang dipindah ke sini sebagai div biasa, dan Canvas
          dibiarkan transparan supaya headline di bawah bisa terlihat menembus
          area kosong di sekitar gunung. */}
      <div className="app-sky-layer" style={{ backgroundColor: SKY_COLOR }} />

      {/* Headline Layer (BARU): Judul besar "GOLEM.inc" — berada DI BELAKANG
          Canvas terrain (gunung/salju/kunang-kunang) tapi DI ATAS layer langit,
          sehingga judul tampak seolah muncul/tertutup sebagian oleh gunung.
          Hanya tampil di Section 1 (Hero), fade out saat pindah section lain. */}
      {isLoadingComplete && (
        <div
          ref={headlineLayerRef}
          className={`app-headline-layer ${headlineClass}`}
          style={{ height: `${HEADLINE_LAYER_HEIGHT_FRACTION * 100}vh` }}
        >
          <HeadlineModel isMobile={isMobile} active={activeSection === 1} mouseRef={mouseCurrentRef} />
        </div>
      )}

      {/* CSS Fog Overlay di lereng gunung (Fadeout di 2D Mode).
          FIX: zIndex sebelumnya 3 (setara/di atas .app-content), sehingga
          fog malah menutupi konten Hero, bukan berada di antara headline
          dan terrain. Karena semua layer di sini position:fixed dengan
          z-index eksplisit, urutan JSX/DOM TIDAK berpengaruh ke tumpukan
          visual — hanya angka z-index yang menentukan. Urutan lengkapnya
          sekarang: sky(0) < headline(1) < fog(2) < terrain(3) < content(4).
          Lihat juga App.css untuk z-index terrain & content yang ikut
          disesuaikan. */}
      {FOG_ENABLED && isLoadingComplete && (
        <div
          ref={fogRef}
          style={{
            position: 'fixed',
            bottom: FOG_BOTTOM,
            left: '50%',
            width: FOG_WIDTH,
            height: FOG_HEIGHT,
            background: FOG_COLOR,
            borderRadius: '50%',
            filter: `blur(${FOG_BLUR}px)`,
            zIndex: 2,
            pointerEvents: 'none',
            opacity: is2DMode ? 0 : 1,
            transition: `opacity ${CANVAS_3D_FADEOUT_DURATION} ease`,
            transform: 'translateX(-53%)',
            // fog-drift (infinite alternate) sekarang dijalankan lewat GSAP (lihat useEffect di atas)
          }}
        />
      )}


      {/* Terrain Canvas 3D (Gunung, Salju Dinamis, Debu Emas & Animasi Kamera) */}
      {/* Saat masuk Section 4 & 5 (2D Mode), Canvas 3D melakukan animasi Fadeout */}
      <div ref={terrainLayerRef} className={isLoadingComplete ? '' : 'terrain-preload'}>
        <div
          ref={terrainWrapperRef}
          className="app-terrain-layer"
          style={{
            opacity: is2DMode ? 0 : 1,
            pointerEvents: !is2DMode && isLoadingComplete ? 'auto' : 'none',
            transition: `opacity ${CANVAS_3D_FADEOUT_DURATION} ease`,
            willChange: isMobile ? 'auto' : 'transform',
          }}
        >
          <Canvas
            frameloop={terrainFrameloop}
            camera={{ position: [11.68, 2.92, -0.94], fov: 45 }}
            dpr={isMobile ? [1, 1.25] : [1, 1.5]}
            gl={{
              // antialias:false -> tidak ada perubahan visual (scene dirender lewat EffectComposer
              // multisampling 0, jadi MSAA bawaan canvas memang tidak terpakai), tapi hemat memori & bandwidth GPU.
              antialias: false,
              alpha: true,
              clearColor: 0x000000,
              clearAlpha: 0,
              powerPreference: 'high-performance',
            }}
            style={{
              position: 'fixed',
              inset: isMobile ? 0 : -PARALLAX_TERRAIN,
              width: isMobile ? '100vw' : `calc(100vw + ${PARALLAX_TERRAIN * 2}px)`,
              height: isMobile ? '100vh' : `calc(100vh + ${PARALLAX_TERRAIN * 2}px)`,
              zIndex: 1,
              pointerEvents: !is2DMode && isLoadingComplete ? 'auto' : 'none',
            }}
          >
            <TerrainLoader activeSection={terrainSection} />
          </Canvas>
        </div>
      </div>


      {/* Section 1 Layer: Hero Golem */}
      <div className={`app-content ${isLoadingComplete ? 'app-content--loaded' : ''} ${activeSection >= 2 ? 'app-content--inactive' : ''}`}>
        <GolemHero
          onExplore={() => setActiveSection(2)}
          isExiting={activeSection >= 2}
          isActive={activeSection === 1}
        />
      </div>

      {/* Section 2 Layer: 3D Car-Glass Cards (Latar Belakang & Visi) */}
      {isLoadingComplete && (
        <SectionTwo
          ref={section2Ref}
          isVisible={activeSection === 2}
          onBack={() => setActiveSection(1)}
          onNext={() => setActiveSection(3)}
        />
      )}

      {/* Section 3 Layer: 3D Car-Glass Cards (Tawaran Kami) */}
      {isLoadingComplete && (
        <div
          className="section-three-wrapper"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: SECTION_3_WRAPPER_Z_INDEX,
            pointerEvents: (activeSection === 3 || frostPhase === 'returning') ? 'auto' : 'none',
          }}
        >
          <SectionThree
            ref={section3Ref}
            // Saat lembar 3.5 turun (returning), Section 3 sudah tampil di baliknya & langsung mendarat (instant)
            isVisible={activeSection === 3 || frostPhase === 'returning'}
            instant={frostPhase === 'returning'}
            onBack={() => setActiveSection(2)}
            onNext={() => playFrost('up')}
          />
        </div>
      )}

      {/* Section 3.5 Layer: Kenapa Kami? (Golem mengambang + Galaxy) */}
      {isLoadingComplete && (
        <SectionWhyUs
          ref={sectionWhyUsRef}
          isVisible={isSection35}
          phase={frostPhase}
          is2D={is2DMode}
          entrySide={whyUsEntryRef.current}
          sheetDurationMs={SHEET_TRANSITION_MS}
          onBack={returnToSection3}
          onScrubBack={(px) => {
            // Scroll ke atas saat konten 3.5 sudah di awal: kabut digerakkan scroll menuju Section 3
            if (scrollLockRef.current) return
            if (startFrostScrub('down')) pushFrostScrub(-px)
          }}
          onNext={() => {
            // Keluar ke sheet 2D: sheet langsung naik, Section 3.5 "mundur" di bawahnya
            // [FIX] Mengembalikan false bila DITOLAK (lock aktif) supaya SectionWhyUs tidak mengunci scroll-nya sendiri.
            if (transitionLockRef.current) return false
            transitionLockRef.current = true
            setActiveSection(4)
            const t = setTimeout(() => { transitionLockRef.current = false }, SHEET_TRANSITION_MS)
            transitionTimersRef.current.push(t)
            return true
          }}
        />
      )}

      {/* Frost Veil (Section 3 <-> 3.5): lembar es di atas semua layer, hanya animasi transform */}
      <FrostVeil ref={frostRef} />

      {/* Section 4 & 5 Layer: Website 2D Sheet Putih (Portfolio, Tech Stack, Clients, Kontak) */}
      {isLoadingComplete && (
        <SectionPortfolio
          isVisible={is2DMode}
          onBackTo3D={backFromSheet}
        />
      )}
    </div>
  )
}