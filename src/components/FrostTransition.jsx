import { useRef, forwardRef, useImperativeHandle } from 'react'
import gsap from 'gsap'
import { EASE } from '../gsap/eases.js'
import './style/FrostTransition.css'

// ============================================================================
// Frost Veil — transisi 3D <-> 3D (Section 3 <-> 3.5), DIGERAKKAN OLEH SCROLL (bukan timer).
//
// Konsep: Section 3.5 adalah LEMBAR yang menimpa Section 3 (sama seperti sheet Section 4 menimpa 3.5).
// Kabut = tepi atas lembar itu. Keduanya bergerak bersamaan, jadi kabut menyatu dengan Section 3.5.
//   'up'   (3 -> 3.5): lembar 3.5 naik dari bawah menimpa Section 3.
//   'down' (3.5 -> 3): lembar 3.5 turun ke bawah menyingkap Section 3 di baliknya.
//
// Alur gesture:
//  1. begin(direction, { onSheet, onDone })
//  2. push(deltaProgress): tiap scroll/swipe menggeser lembar + kabut (progress 0..1), bisa maju & mundur.
//  3. release(): dipanggil App.jsx setelah scroll berhenti + jeda settleDelayMs. THRESHOLD menentukan:
//       progress >= commitThreshold  => dilanjutkan sampai selesai
//       progress <  commitThreshold  => dibatalkan (kembali ke section semula)
//  onSheet(yVh) : posisi tepi atas lembar 3.5 (satuan vh, 0 = menutup penuh) — dipakai SectionWhyUs.
//  onDone(committed): gesture selesai; App.jsx baru mengganti activeSection di sini.
// Hanya `transform` yang dianimasikan => ringan (compositor).
// ============================================================================
export const FROST_VEIL_CONFIG = {
  scrollDistancePx: 2600,  // Jarak scroll mouse/trackpad (px) untuk menggerakkan lembar dari 0 sampai 1 (makin BESAR = makin lambat/tidak sensitif)
  touchDistancePx: 1500,   // Jarak swipe layar sentuh (px) untuk menggerakkan lembar dari 0 sampai 1 (makin BESAR = makin lambat)
  settleDelayMs: 2000,     // Setelah scroll/swipe berhenti, kabut DIAM di posisinya selama ini (ms), baru lanjut/batal menurut threshold
  commitThreshold: 0.4,    // Threshold (0-1): setelah jeda settleDelayMs, di atas nilai ini transisi DILANJUTKAN, di bawahnya DIBATALKAN
  fogHeightVh: 70,         // Tinggi kabut di atas tepi lembar (vh). Makin besar = kabut makin tebal/panjang (ubah juga --fv-height di CSS bila perlu)
  followDuration: 0.5,     // Kelembutan lembar mengikuti scroll (detik) — makin kecil makin "menempel"
  settleDuration: 2.2,     // Durasi melanjutkan transisi dari progress 0 ke 1 (detik, dikali sisa jarak) — makin besar makin pelan
  cancelDuration: 2.0,     // Durasi membatalkan transisi dari progress 1 ke 0 (detik, dikali jarak) — makin besar makin pelan
  minSettleDuration: 0.8,  // Durasi minimum lanjut/batal (detik), agar sisa jarak yang pendek tetap terlihat halus
  reducedMotionDuration: 0.3,
}

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const OVERLAP_VH = 0.2   // kabut menumpuk sedikit ke lembar agar tidak ada garis celah di sambungan

const FrostVeil = forwardRef(function FrostVeil(_props, ref) {
  const elRef = useRef(null)
  const tweenRef = useRef(null)
  const shownRef = useRef({ p: 0 })      // progress yang TAMPIL di layar (mengikuti target dengan halus)
  const targetRef = useRef(0)            // progress tujuan (hasil akumulasi scroll)
  const dirRef = useRef(null)            // 'up' | 'down' | null (null = tidak ada gesture)
  const cbRef = useRef({})

  const reset = () => {
    const el = elRef.current
    if (!el) return
    el.classList.remove('frost-veil--active')
    el.style.transform = ''
  }

  const stopTween = () => {
    if (tweenRef.current) {
      tweenRef.current.kill()
      tweenRef.current = null
    }
  }

  // Terapkan progress ke posisi lembar 3.5 (via onSheet) + kabut di atas tepinya
  const apply = (p) => {
    const dir = dirRef.current
    if (!dir) return
    const fog = FROST_VEIL_CONFIG.fogHeightVh
    const s = dir === 'up' ? p : 1 - p                // s: seberapa jauh lembar 3.5 menutup layar (0 = di bawah, 1 = menutup penuh)
    const sheetY = (100 + fog) * (1 - s)              // tepi atas lembar (vh dari atas layar)
    const el = elRef.current
    if (el) el.style.transform = `translate3d(0, ${(sheetY - fog + OVERLAP_VH).toFixed(3)}vh, 0)`
    if (cbRef.current.onSheet) cbRef.current.onSheet(sheetY)
  }

  const animateTo = (target, duration, ease, onComplete) => {
    stopTween()
    tweenRef.current = gsap.to(shownRef.current, {
      p: target,
      duration,
      ease,
      overwrite: true,
      onUpdate: () => apply(shownRef.current.p),
      onComplete: () => {
        tweenRef.current = null
        apply(shownRef.current.p)
        if (onComplete) onComplete()
      },
    })
  }

  useImperativeHandle(ref, () => ({
    // direction: 'up' (3 -> 3.5, lembar 3.5 naik dari bawah) | 'down' (3.5 -> 3, lembar 3.5 turun)
    begin: (direction, { onSheet, onDone } = {}) => {
      const el = elRef.current
      stopTween()
      reset()
      cbRef.current = { onSheet, onDone }
      dirRef.current = direction
      shownRef.current.p = 0
      targetRef.current = 0
      if (el) {
        el.style.setProperty('--fv-height', `${FROST_VEIL_CONFIG.fogHeightVh}vh`)
        el.classList.add('frost-veil--active')
      }
      apply(0)
    },

    // Geser lembar sebesar deltaProgress (boleh negatif = ditarik balik oleh scroll berlawanan arah)
    // Mengembalikan:
    // - false: gesture selesai/batal, kendali scroll diserahkan langsung ke section
    // - 'committed': lembar baru saja menutup 100% & section sudah diganti (event dikonsumsi, JANGAN diteruskan)
    // - 'completing': lembar sedang meluncur mulus ke 100% (jangan set timer pause)
    // - true: gesture masih aktif bergerak mengikuti input
    push: (deltaProgress) => {
      if (!dirRef.current) return false

      // Scroll mundur di titik awal: batalkan
      if (targetRef.current <= 0 && deltaProgress < 0) {
        stopTween()
        shownRef.current.p = 0
        targetRef.current = 0
        apply(0)
        const done = cbRef.current.onDone
        dirRef.current = null
        cbRef.current = {}
        reset()
        if (done) done(false, true)
        return false
      }

      const nextTarget = clamp01(targetRef.current + deltaProgress)
      targetRef.current = nextTarget

      // Jika sudah mencapai 100%:
      if (nextTarget >= 1) {
        // Jika tampilan sudah di 100% (atau nyaris 1.0): commit seketika
        if (shownRef.current.p >= 0.98) {
          stopTween()
          shownRef.current.p = 1
          apply(1)
          const done = cbRef.current.onDone
          dirRef.current = null
          cbRef.current = {}
          reset()
          // [FIX] Dulu `return false` => App mengira gesture DIBATALKAN lalu meneruskan event wheel yang sama
          // ke handler section (dengan state lama) => memulai gesture BARU ke arah sebaliknya/yang sama.
          // 'committed' = gesture selesai & event sudah DIKONSUMSI. instant tidak diset agar App memberi jeda scroll.
          if (done) done(true)
          return 'committed'
        }
        // Jika tampilan masih meluncur menuju 1.0: biarkan animasi selesai mulus lalu commit
        const remaining = 1 - shownRef.current.p
        const dur = Math.max(0.1, remaining * FROST_VEIL_CONFIG.followDuration)
        animateTo(1, dur, 'power2.out', () => {
          const done = cbRef.current.onDone
          dirRef.current = null
          cbRef.current = {}
          reset()
          if (done) done(true)   // [FIX] bukan instant: App memberi jeda agar ekor inersia tidak memicu transisi lagi
        })
        return 'completing'
      }

      animateTo(targetRef.current, FROST_VEIL_CONFIG.followDuration, 'power2.out')
      return true
    },

    // Tutup gesture SEKETIKA di titik awal (tanpa animasi & tanpa jeda), dianggap batal
    abort: () => {
      if (!dirRef.current) return
      stopTween()
      shownRef.current.p = 0
      targetRef.current = 0
      apply(0)
      const done = cbRef.current.onDone
      dirRef.current = null
      cbRef.current = {}
      reset()
      if (done) done(false, true)
    },

    // Scroll berhenti (+ jeda): threshold menentukan lanjut (true) atau batal (false)
    release: () => {
      if (!dirRef.current) return false
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const committed = targetRef.current >= FROST_VEIL_CONFIG.commitThreshold
      const from = shownRef.current.p
      const finish = () => {
        const done = cbRef.current.onDone
        dirRef.current = null
        cbRef.current = {}
        reset()
        if (done) done(committed)
      }

      // Jika sudah hampir mentok 100%, commit seketika tanpa jeda
      if (committed && (from >= 0.98 || targetRef.current >= 0.999)) {
        stopTween()
        shownRef.current.p = 1
        apply(1)
        finish()
        return true
      }

      const base = committed
        ? FROST_VEIL_CONFIG.settleDuration * (1 - from)
        : FROST_VEIL_CONFIG.cancelDuration * from
      const duration = reduce
        ? FROST_VEIL_CONFIG.reducedMotionDuration
        : Math.max(FROST_VEIL_CONFIG.minSettleDuration, base)
      targetRef.current = committed ? 1 : 0
      animateTo(targetRef.current, duration, EASE.inOutCubic, finish)
      return committed
    },

    // Batalkan paksa tanpa animasi (mis. user lompat lewat sidebar)
    kill: () => {
      stopTween()
      dirRef.current = null
      cbRef.current = {}
      shownRef.current.p = 0
      targetRef.current = 0
      reset()
    },

    isActive: () => dirRef.current != null,
  }))

  return (
    <div ref={elRef} className="frost-veil" aria-hidden="true">
    </div>
  )
})

export default FrostVeil