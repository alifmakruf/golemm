import { Suspense, useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, MeshReflectorMaterial, useAnimations, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import TechText from './TechText'
import StrokeText from './StrokeText'
import { useModelWaves } from './TerrainWaves.jsx'
import { useGolemClone } from './useGolemClone.js'
import './style/SectionWhyUs.css'

// ================== Parameter Tuning: Section 3.5 (Kenapa Kami?) ==================
// Anda dapat menyesuaikan parameter di bawah ini sesuka hati:

// --- Model Golem (Content 0) ---
// Golem di-FIT otomatis ke ukuran target dan dipusatkan.
const GOLEM_TARGET_SIZE = 2.7              // Ukuran sisi terpanjang golem di desktop (world unit)
const GOLEM_TARGET_SIZE_MOBILE = 1.4       // Ukuran di HP/tablet
const GOLEM_SCALE = 1.0                    // Pengali tambahan di atas auto-fit (1 = pas, 1.2 = 20% lebih besar)

// --- Posisi Vertikal Golem Head (Content 0) ---
// 0.0 = pas tepat di tengah vertikal pandangan kamera (CAMERA_LOOK_Y = 0.85).
// Ubah nilai ini jika ingin menggeser: positif = naik, negatif = turun.
const GOLEM_HEAD_VERTICAL_OFFSET = 0.0     // Offset vertikal dari tengah kamera (world unit)
const GOLEM_FLOAT_CLEARANCE = 0.55         // Jarak tepi bawah golem ke lantai kaca (world unit)
const GOLEM_BOB_AMPLITUDE = 0.09           // Jarak naik-turun mengambang
const GOLEM_BOB_SPEED = 0.9                // Kecepatan mengambang
const GOLEM_PLAY_ANIMATION = true          // Mainkan animasi ekspresi alis & mulut golem dari GLB
const GOLEM_ANIM_SPEED = 0.8               // Kecepatan animasi kepala golem
const GOLEM_ANIM_DELAY_SEC = 4.5           // Jeda diam (detik) antar pengulangan animasi alis & mulut. 0 = loop terus tanpa jeda

// --- Animasi Gelombang (Wave Animation seperti TerrainWaves) ---
const GOLEM_WAVE_ENABLED = true            // Aktifkan animasi ombak wireframe pada model golem & tangan
const GOLEM_WAVE_COLOR = '#67e8f9'         // Warna wireframe ombak golem
const GOLEM_WAVE_AUTO_PULSE = false        // false = gelombang muncul saat diklik (tidak menutupi model terus-menerus)
const GOLEMHAND_WAVE_COLOR = '#67e8f9'     // Warna wireframe ombak tangan
const GOLEMHAND_WAVE_AUTO_PULSE = false    // false = gelombang muncul saat diklik

// Rotasi dasar golem: serong kanan (Y positif) + serong atas (X negatif) = melamun menatap langit
const GOLEM_ROTATION_X = -0.4              // Serong atas (negatif = mendongak, radian)
const GOLEM_ROTATION_Y = 0.35              // Serong kanan (positif = menoleh kanan, radian)
const GOLEM_ROTATION_Z = 0                 // Tidak ada roll
const GOLEM_SWAY_YAW = 0                // Ayunan menoleh kiri-kanan pelan (radian). 0 = diam menghadap tetap
const GOLEM_SWAY_SPEED = 0.65              // Kecepatan ayunan menoleh

// --- Orbit Batu (Putaran Horisontal Batu Mengambang) ---
const TURNTABLE_SPEED = 0.22               // Kecepatan batu mengorbit golem (radian/detik)

// --- Batu/Meteorit Mengambang (PLACEHOLDER — model belum dibuat di Blender) ---
// Sementara memakai dodecahedron flat-shaded. Ganti ke useGLTF saat model siap.
const ROCKS_ENABLED = true                 // Aktifkan/matikan batu placeholder
const ROCK_COUNT = 9                       // Jumlah batu mengambang
const ROCK_RADIUS_MIN = 2.7                // Jarak orbit terdekat dari golem
const ROCK_RADIUS_MAX = 6.9                // Jarak orbit terjauh dari golem
const ROCK_Y_MIN = 0.7                     // Tinggi terendah batu dari lantai
const ROCK_Y_MAX = 3.3                     // Tinggi tertinggi batu dari lantai
const ROCK_SIZE_MIN = 0.09                 // Ukuran terkecil batu
const ROCK_SIZE_MAX = 0.3                  // Ukuran terbesar batu
const ROCK_FLOAT_SPEED = 0.6               // Kecepatan batu naik-turun mengambang
const ROCK_FLOAT_AMPLITUDE = 0.22          // Jarak mengambang naik-turun (world unit)
const ROCK_COLOR = '#15171b'               // Warna batu placeholder
const ROCK_EMISSIVE = '#0a2a44'            // Cahaya samar dari dalam batu (biru kristal)

// --- Hotspot di Batu Mengambang (dot kecil + teks di atasnya, tanpa garis) ---
// Dot menempel di puncak batu & ikut orbit/mengambang. Teks muncul tepat di atas dot.
// rock = nomor batu (0 .. ROCK_COUNT-1). Tata letak batu deterministik, jadi nomor yang sama = batu yang sama.
const ROCK_HOTSPOTS_ENABLED = true
const ROCK_HOTSPOTS = [
  { rock: 0, label: 'const MODEL_3D = true' },
  { rock: 2, label: 'function FOG_EFFECT(){}' },
  { rock: 4, label: 'useEffect(() => {})' },
  { rock: 6, label: 'import { Canvas, useFrame, useThree } from @react - three / fiber' },
]
const ROCK_HOTSPOT_HIDE_ON_MOBILE = false  // true = sembunyikan hotspot batu di layar mobile
const ROCK_HOTSPOT_DOT_SIZE = 2            // Diameter dot (px)
const ROCK_HOTSPOT_DOT_COLOR = 'transparent'   // Warna dot, glow & cincin denyut
const ROCK_HOTSPOT_RING_PULSE = false       // Cincin berdenyut di sekeliling dot
const ROCK_HOTSPOT_TEXT_SIZE = 12          // Ukuran teks (px)
const ROCK_HOTSPOT_TEXT_SIZE_MOBILE = 10   // Ukuran teks di mobile (px)
const ROCK_HOTSPOT_TEXT_COLOR = '#e6fbff1f'  // Warna teks
const ROCK_HOTSPOT_TEXT_BG = 'transparent' // Latar teks ('transparent' = tanpa latar)
const ROCK_HOTSPOT_TEXT_GAP = 4            // Jarak teks ke dot (px)
const ROCK_HOTSPOT_ANCHOR_Y = 0.1         // Posisi dot di batu: 0 = pusat, 1 = puncak batu
const ROCK_HOTSPOT_OCCLUDE_RADIUS = 0.3    // Radius area golem di layar (tinggi layar = 1); hotspot di belakang area ini dipudarkan
const ROCK_HOTSPOT_OCCLUDE_FEATHER = 0.2 // Kehalusan tepi pemudaran
const ROCK_HOTSPOT_BEHIND_MARGIN = 0.2     // Batu dianggap "di belakang golem" setelah selisih jarak kamera melebihi ini
const ROCK_HOTSPOT_BEHIND_FADE = 0.8       // Rentang jarak transisi depan -> belakang
const ROCK_HOTSPOT_Z_INDEX = 20            // z-index label HTML

// --- Lantai Kaca Gelap Reflektif (MeshReflectorMaterial) ---
// Lantai = bidang kaca obsidian yang MEMANTULKAN golem, batu & cahaya, ditambah panggung kaca
// (platform) berbingkai cahaya tepat di bawah golem. Tepi lantai jauh dilebur oleh fog.
const GLASS_FLOOR_ENABLED = false           // Aktifkan/matikan lantai kaca reflektif
const GLASS_FLOOR_SIZE = 60                // Ukuran bidang lantai (besar, tepinya dilebur fog)
const GLASS_FLOOR_COLOR = '#08102c'        // Warna dasar kaca (obsidian biru gelap)
const GLASS_FLOOR_ROUGHNESS = 0.22         // 0 = cermin sempurna, 1 = kusam (kecil = pantulan tajam)
const GLASS_FLOOR_METALNESS = 0.55         // Sifat metalik kaca
const GLASS_FLOOR_REFLECTIVITY = 1         // Kekuatan refleksi (0-1)
const GLASS_FLOOR_MIX_STRENGTH = 2.4       // Seberapa terang pantulan dicampur ke permukaan
const GLASS_FLOOR_MIX_BLUR = 0.8           // Pantulan makin kabur sesuai roughness/jarak
const GLASS_FLOOR_BLUR = [220, 70]         // Blur pantulan [horizontal, vertikal]
const GLASS_FLOOR_RESOLUTION = 1024        // Resolusi pantulan (desktop). Turunkan bila berat
const GLASS_FLOOR_RESOLUTION_MOBILE = 512
const FLOOR_FOG_COLOR = '#070a26'          // Warna fog = warna cakrawala background
const FLOOR_FOG_NEAR = 9                   // Fog mulai dari jarak ini dari kamera
const FLOOR_FOG_FAR = 30                   // Fog menutup penuh di jarak ini

// --- Panggung Kaca (Platform) di Bawah Golem ---
const PLATFORM_ENABLED = false              // Aktifkan/matikan panggung kaca
const PLATFORM_RADIUS = 3.3                // Radius panggung
const PLATFORM_THICKNESS = 0.14            // Tebal panggung
const PLATFORM_OPACITY = 0.38              // Transparansi kaca panggung
const PLATFORM_COLOR = '#0b3a66'           // Warna tubuh kaca panggung
const PLATFORM_RIM_COLOR = '#67e8f9'       // Warna garis cahaya di tepi panggung
const PLATFORM_RIM_INTENSITY = 2.6         // Terang garis tepi (di atas 1 ikut bloom)

// --- Kolam Energi di Bawah Golem (glow + riak cincin) ---
const POOL_ENABLED = false                  // Aktifkan/matikan glow & riak di lantai
const POOL_RADIUS = 3.1                    // Radius glow kolam
const POOL_COLOR_CORE = 'rgba(120, 225, 255, 0.95)'
const POOL_COLOR_MID = 'rgba(56, 130, 255, 0.35)'
const RIPPLE_COUNT = 3                     // Jumlah cincin riak
const RIPPLE_PERIOD = 5.5                  // Detik per siklus riak
const RIPPLE_MAX_SCALE = 4.4               // Seberapa jauh riak melebar
const RIPPLE_COLOR = '#67e8f9'

// --- Debu Kosmik Melayang (partikel) ---
const DUST_ENABLED = true                  // Aktifkan/matikan partikel debu
const DUST_COUNT = 100                     // Jumlah partikel (otomatis dikurangi di HP)
const DUST_COUNT_MOBILE = 80
const DUST_SPREAD_X = 7.5                  // Sebaran horizontal
const DUST_SPREAD_Z = 6                    // Sebaran kedalaman
const DUST_HEIGHT = 5.5                    // Tinggi maksimum sebelum partikel muncul lagi dari lantai
const DUST_SIZE = 0.06                     // Ukuran partikel

// --- Pencahayaan Multi-Titik (Multi-Point Dynamic Lighting) ---
// Lantai kaca ada di y = 0, golem melayang di atasnya.
const MULTI_LIGHTS = [
  // 1. Cyan Elektrik (kiri-atas-depan)
  { color: '#38bdf8', position: [-4.2, 3.4, 3.4], intensity: 2.0, distance: 18 },
  // 2. Violet Galaksi (kanan-atas-depan)
  { color: '#c084fc', position: [4.4, 3.8, 2.6], intensity: 2.8, distance: 18 },
  // 3. Magenta Kosmik (kiri-belakang)
  { color: '#ffffff', position: [-3.4, 2.6, -3.8], intensity: 2.2, distance: 18 },
  // 4. Gold Starlight (kanan-belakang)
  { color: '#ffffff', position: [3.6, 2.4, -3.4], intensity: 1.6, distance: 18 },
  // 5. Caustic Glint (depan, rendah — kilau tajam di wajah golem & lantai)
  { color: '#e0f2fe', position: [0.0, 0.9, 2.4], intensity: 5.2, distance: 20 },
  // 6. Under-Glow (tepat di bawah golem, menyorot ke atas)
  // { color: '#25bdeb', position: [0.0, 0.25, 0.0], intensity: 3.6, distance: 12 },
]

// --- Animasi "Pembatuan" Dr. Stone (Dinonaktifkan agar golem 100% solid batu bertekstur) ---
const HOLOGRAM_ENABLED = false             // false = golem langsung solid batu utuh, tanpa scanline pembatuan
const HOLOGRAM_DURATION_SEC = 2.2          // Durasi total animasi pembatuan (detik)
const HOLOGRAM_WIRE_COLOR = '#93f8ff'      // Warna wireframe scan hologram
const HOLOGRAM_WIRE_OPACITY = 0.05         // Opasitas wireframe saat aktif
const SCAN_WIRE_LEAD = 0                // Seberapa jauh wireframe lebih maju dari scanline solid (0-1 normalized)

// --- Kamera Sinematik ---
// Kamera mulai agak jauh lalu perlahan "dolly in" mengikuti animasi pembatuan,
// kemudian melayang pelan + parallax mengikuti kursor.
const CAMERA_FOV = 45                      // Field of view kamera
const CAMERA_END_DISTANCE = 5.8            // Jarak kamera ke golem setelah dolly selesai (desktop)
const CAMERA_DOLLY_DISTANCE = 2.6          // Jarak tambahan di awal (ditarik mundur sebanyak ini)
const CAMERA_HEIGHT = 1.55                 // Tinggi kamera dari lantai
const CAMERA_LOOK_Y = 0.85                 // Titik yang ditatap kamera (lebih rendah = golem naik di layar, ruang untuk teks)
const CAMERA_FIT_WIDTH = 3.4               // Lebar scene minimum yang harus terlihat (otomatis menjauh di layar sempit/HP)
const CAMERA_PARALLAX_X = 0.45             // Geser kamera horizontal mengikuti kursor
const CAMERA_PARALLAX_Y = 0.2              // Geser kamera vertikal mengikuti kursor

// --- Bloom ---
const BLOOM_INTENSITY = 0.85
const BLOOM_THRESHOLD = 0.18
const BLOOM_SMOOTHING = 0.25
const BLOOM_RADIUS = 0.5

// --- Bintang-bintang background ---
const STAR_COUNT = 80                       // Jumlah bintang di background galaxy

// --- Glitch Text ---
const GLITCH_TEXTS = [

]
const GLITCH_COUNT = 14                     // Jumlah teks glitch yang tampil sekaligus

// --- Tampilan material golem (sama seperti GolemModel.jsx) ---
const STONE_BRIGHTNESS = 0.35               // Kecerahan batu (0-1)
const CRACK_MATERIAL_NAME = 'Material.005'
const CRACK_GLOW_COLOR = '#4ae0ff'
const CRACK_GLOW_INTENSITY = 0.15        // Sesuaikan dengan GolemModel agar bloom terlihat
// Mata mengikuti kursor (sama seperti hero). Offset dihitung di ruang kamera lalu diputar ke ruang lokal model,
// jadi tetap benar walau golem berputar mengikuti scroll.
const EYE_FOLLOW_ENABLED = true
const EYE_MAX_OFFSET = 0.045          // Jarak geser maksimum bola mata (unit lokal model, sama dengan hero)
const EYE_FOLLOW_DAMPING = 4.5       // Makin kecil makin halus/lambat
const EYE_GLOW_COLOR = '#4ae0ff'
const EYE_GLOW_INTENSITY = 10.55         // Sama seperti GolemModel — cukup terang untuk bloom threshold

// --- Scroll-Driven 200vh Multi-Content (Content 0: Golem, Content 1: GolemHand) ---
// Total perjalanan terasa 200vh: user benar-benar scroll ke bawah, dan rotasi model
// mengikuti input scroll secara dinamis (Scroll-Driven Animation), bukan durasi statis.
// Animasi fade dihilangkan: model 100% solid, berpindah posisi meluncur naik/turun melewati frame.
// Bintang, debu kosmik, dan batu-batu yang mengorbit TETAP ADA di tengah scene!
const SCROLL_DISTANCE_PX = 1400              // Jarak akumulasi scroll wheel (px) untuk beralih penuh 0 -> 1 (dinaikkan agar transisi lebih lega & tidak numpuk)
const SCROLL_WHEEL_FACTOR = 1.0             // Pengali sensitivitas mouse wheel (1.0 = pas, 1.2 = lebih cepat)
const SCROLL_TOUCH_FACTOR = 1.6             // Pengali sensitivitas touch swipe di layar sentuh
const SCROLL_LERP_SPEED = 8.0               // Kecepatan kehalusan interpolasi gerakan 3D (makin besar = makin reaktif & nempel ke scroll)

// --- Proteksi Scroll Kebablasan (Overshoot Guard) ---
// Melindungi agar scroll di Section 3.5 tidak mudah tergelincir/kebablasan ke Section 3 atau Section 4
const SCROLL_OVERSHOOT_EXIT_PX = 480        // Jarak scroll ekstra saat sudah mentok sebelum keluar section (onNext/onBack)
const OVERSHOOT_COOLDOWN_MS = 350           // Jeda waktu (ms) serap inersia saat baru menyentuh batas sebelum akumulasi exit diizinkan

// --- Parameter Animasi Muncul Konten (Entrance Animation) ---
// Konten 3.5 disembunyikan sampai gelombang ombak selesai menyapu keluar viewport ke kanan atas
const CONTENT_ENTRANCE_OFFSET_Y = 35        // Jarak slide ke atas (px) untuk efek fade in up

// --- Rotasi Scroll-Driven (Sumbu Vertikal Y) ---
// Berputar dinamis sesuai putaran scroll user (scroll dikit = putar dikit, scroll balik = putar balik)
const SCROLL_SPIN_Y = Math.PI * 1.0         // Total putaran sumbu vertikal (radian: 2*PI = 360° putaran penuh)
const SCROLL_SPIN_X = 0.0                   // Putaran sumbu X (tumble vertikal jika diinginkan, default 0 untuk putaran vertikal murni)

// --- Pergerakan Model (Jarak diperjauh agar konten 1 dan 2 tidak bertumpuk) ---
const GOLEM_TRAVEL_Y = 5.8                  // Jarak model Golem meluncur naik ke atas keluar layar saat discroll (world unit)
const GOLEMHAND_TRAVEL_Y = 5.8              // Jarak model GolemHand meluncur dari bawah layar ke tengah panggung (world unit)
const TRAVEL_SCALE_DROP = 0.15              // Pengurangan skala saat model meluncur menjauh (0.15 = mengecil 15%)

// --- Model 3D GolemHand (/golemhand.glb) ---
const GOLEMHAND_MODEL_SIZE = 5.9            // Ukuran sisi terpanjang model tangan di desktop (world unit)
const GOLEMHAND_MODEL_SIZE_MOBILE = 3.35    // Ukuran model tangan di HP/tablet
const GOLEMHAND_MODEL_SCALE = 1.0           // Pengali skala tambahan di atas auto-fit
const GOLEMHAND_MODEL_Y = 0.45              // Posisi ketinggian tangan di tengah panggung (world unit)
const GOLEMHAND_MODEL_ROT_X = 3          // Kemiringan sumbu X (radian, agak condong ke depan)
const GOLEMHAND_MODEL_ROT_Y = -1          // Rotasi sumbu vertikal Y (radian, menghadap agak serong kanan)
const GOLEMHAND_MODEL_ROT_Z = -.5           // Kemiringan roll (radian)
const GOLEMHAND_BOB_AMPLITUDE = 0.08        // Jarak naik-turun tangan mengambang
const GOLEMHAND_BOB_SPEED = 0.85            // Kecepatan mengambang tangan
const GOLEMHAND_PLAY_ANIMATION = true       // Mainkan animasi gerak jari tangan dari file GLB
const GOLEMHAND_ANIM_SPEED = 0.7           // Kecepatan animasi gerakan jari tangan
const GOLEMHAND_ANIM_DELAY_SEC = 3.0        // Jeda diam (detik) antar pengulangan animasi jari tangan. 0 = loop terus tanpa jeda
const GOLEMHAND_CRACK_GLOW_COLOR = '#4ae0ff' // Warna glow retakan biru kristal tangan
const GOLEMHAND_CRACK_GLOW_INTENSITY = 0.25 // Intensitas cahaya retakan tangan

// --- Parameter TechText Content 0 (Kenapa Memilih Kami?) ---
const WHYUS_HEADLINE_TEXT = 'Our Adventages' // Teks headline interaktif Content 0
const WHYUS_HEADLINE_FONT_SIZE = 79                // Ukuran font sama dengan Hand To Hand
const WHYUS_HEADLINE_FONT_WEIGHT = 700             // Ketebalan huruf
const WHYUS_HEADLINE_LETTER_SPACING = -0.04        // Spasi antar huruf (em)
const WHYUS_HEADLINE_COLOR = '#ffffff'             // Warna huruf
const WHYUS_HEADLINE_ACCENT = '#67e8f9'            // Warna frame & partikel
const WHYUS_HEADLINE_REACH = 180                   // Radius efek hover kursor (px)
const WHYUS_HEADLINE_SPECKS = 12                   // Jumlah partikel aktif (0 = off)
const WHYUS_HEADLINE_REVEAL = 'letter'             // Mode reveal: 'letter' | 'area' | 'off'
const CONTENT_0_SHOW_SUBTITLE = false              // Subtitle dimatikan sesuai arahan (layout tengah atas)
const CONTENT_0_SUBTITLE = 'Pengalaman visual 3D interaktif yang dibangun dengan teknologi mutakhir dan perhatian pada setiap detail.'

// --- Parameter TechText GolemHand (Content 1) ---
const GOLEMHAND_TEXT = 'Our Hands'          // Teks headline interaktif
const GOLEMHAND_FONT_SIZE = 79              // Ukuran font (px) — proporsional di tengah atas
const GOLEMHAND_FONT_WEIGHT = 700           // Ketebalan huruf
const GOLEMHAND_LETTER_SPACING = -0.04      // Spasi antar huruf (em)
const GOLEMHAND_COLOR = '#ffffff'           // Warna huruf
const GOLEMHAND_ACCENT = '#67e8f9'          // Warna frame & partikel
const GOLEMHAND_REACH = 180                 // Radius efek hover (px)
const GOLEMHAND_SPECKS = 12                 // Jumlah partikel aktif (0 = off)
const GOLEMHAND_REVEAL = 'letter'           // Mode reveal: 'letter' | 'area' | 'off'

// --- Indikator Scroll 200vh (Track di Samping Kanan) ---
const SHOW_SCROLL_INDICATOR = true          // Tampilkan track bar scroll di samping kanan layar

// --- [BARU] Kehalusan Masuk / Keluar Section 3.5 ---
// Model Golem & Tangan tidak lagi "pop" (visible true/false dalam 1 frame). Mereka TIBA dengan
// gerak mengendap: naik dari bawah + membesar + memudar-masuk + sedikit berputar. Gerakannya memakai
// peluruhan eksponensial berbasis waktu sehingga terasa sama di layar 60Hz maupun 144Hz.
const ENTRY_DAMP_RATE = 3.6                 // Kecepatan model tiba (1/detik). Kecil = lebih lambat & lembut
const ENTRY_RISE_FROM = -0.9                // Model mulai sejauh ini DI BAWAH posisi akhir (world unit)
const ENTRY_SCALE_FROM = 0.86               // Skala awal relatif terhadap skala akhir (1 = tanpa efek skala)
const ENTRY_SPIN_FROM = 0.7                 // Putaran Y awal yang mengendap ke posisi akhir (radian)
const ENTRY_FADE_SPEED = 1.5                // Pengali kecepatan fade (>1 = opacity tuntas lebih dulu dari gerak)
const ARRIVAL_INPUT_LOCK_MS = 100           // Abaikan scroll sesaat setelah konten tiba (serap ekor inersia gelombang)

// Render canvas 3D SELAMA gelombang menyapu (preview), supaya batu & debu kosmik sudah ikut
// tersibak oleh gelombang dan shader/bloom sudah terkompilasi SEBELUM Golem tiba (tidak ada hitch).
// Di HP dimatikan (hemat GPU) — shader tetap dikompilasi lewat gl.compile.
// [PERFORMA] Default MATI: merender canvas 3.5 bersamaan dengan canvas terrain + mask + frost adalah
// beban terbesar saat gelombang menyapu. Pemanasan shader tetap dilakukan (lihat `warm` di bawah).
const PREVIEW_RENDER_DESKTOP = true
const PREVIEW_RENDER_MOBILE = false

// Datang dari sheet 2D (scroll ke atas dari Section 4)? true = buka langsung di konten terakhir
// ("Hand To Hand") agar terasa kontinu; false = selalu mulai dari Golem.
const RETURN_FROM_SHEET_TO_LAST_CONTENT = true

// ================== Parameter Tuning: Paragraf Kiri & Kanan (StrokeText) ==================
// Anda dapat menyesuaikan teks, posisi, warna, dan animasi teks samping di bawah ini:

// --- Kontrol Tampilan Panel Samping ---
const SIDE_PANELS_ENABLED = true              // true = aktifkan panel teks kiri & kanan di samping model 3D
const SIDE_PANELS_SHOW_ON_MOBILE = false       // false = sembunyikan di HP/tablet (layar <= 960px) agar model 3D tidak tertutup
const SIDE_PANEL_TOP_PERCENT = 52             // Posisi vertikal tengah panel (% dari atas layar, 50 = pas di tengah)
const SIDE_PANEL_WIDTH = 'clamp(240px, 22vw, 340px)' // Lebar kolom teks samping
const SIDE_PANEL_LEFT_OFFSET = 'clamp(1.5rem, 3.8vw, 4.5rem)' // Jarak panel kiri dari tepi kiri layar
const SIDE_PANEL_RIGHT_OFFSET = 'clamp(1.5rem, 3.8vw, 4.5rem)' // Jarak panel kanan dari tepi kanan layar
const SIDE_PANEL_GAP = '1.75rem'              // Jarak vertikal antar kartu paragraf di sisi yang sama
const SIDE_PANEL_REPLAY_ON_HOVER = true       // Replay animasi melukis saat kursor diarahkan (hover) ke teks

// --- Parameter Animasi StrokeText: Content 0 (Kenapa Memilih Kami? / Golem) ---
const C0_STROKE_COLOR = '#ffffff'             // Warna garis outline melukis (cyan neon)
const C0_FILL_COLOR = '#ffffff'               // Warna isi huruf setelah garis selesai terlukis (putih)
const C0_STROKE_WIDTH = .5                   // Ketebalan garis lukis SVG
const C0_DRAW_DURATION = .1                  // Detik durasi melukis garis per huruf
const C0_FILL_DELAY = 0.9                     // Detik jeda sebelum warna isi menyapu
const C0_STAGGER = 0.04                       // Jeda antar huruf (detik)
const C0_FONT_SIZE = 35                       // Ukuran font judul kartu StrokeText (px)
const C0_FONT_WEIGHT = 600                    // Ketebalan font judul
const C0_LETTER_SPACING = .5                // Jarak antar huruf (px)
const C0_FILL_MODE = 'wipe'                   // Mode isi: 'wipe' (menyapu dari kiri) | 'fade' (memudar) | 'none'
const C0_EASE = 'power2.out'                  // Kurva percepatan GSAP untuk garis

// --- Parameter Animasi StrokeText: Content 1 (Hand To Hand / GolemHand) ---
const C1_STROKE_COLOR = '#ffffff'             // Warna garis outline melukis Content 1 (violet neon)
const C1_FILL_COLOR = '#ffffff'               // Warna isi huruf Content 1 (putih kristal)
const C1_STROKE_WIDTH = .5                   // Ketebalan garis lukis SVG
const C1_DRAW_DURATION = .1                  // Detik durasi melukis garis per huruf
const C1_FILL_DELAY = 0.9                     // Detik jeda sebelum warna isi menyapu
const C1_STAGGER = 0.04                       // Jeda antar huruf (detik)
const C1_FONT_SIZE = 35                       // Ukuran font judul kartu StrokeText (px)
const C1_FONT_WEIGHT = 600                    // Ketebalan font judul
const C1_LETTER_SPACING = .5                // Jarak antar huruf (px)
const C1_FILL_MODE = 'wipe'                   // Mode isi: 'wipe' | 'fade' | 'none'
const C1_EASE = 'power2.out'                  // Kurva percepatan GSAP

// --- Gaya Teks & Paragraf (Floating Ambient / Tanpa Card) ---
const CARD_BG = 'transparent'                 // 'transparent' = tanpa latar belakang kotak/card
const CARD_BORDER_COLOR = 'transparent'       // 'transparent' = tanpa garis tepi kotak/card
const CARD_BORDER_RADIUS = '0px'              // Kelengkungan sudut
const CARD_PADDING = '0.35rem 0'              // Ruang padding minimalis tanpa kotak
const CARD_BLUR = '0px'                       // Tanpa blur kotak
const CARD_BOX_SHADOW = 'none'                // Tanpa bayangan kotak
const DESC_FONT_SIZE = 'clamp(0.85rem, 0.95vw, 0.95rem)' // Ukuran font isi deskripsi paragraf
const DESC_COLOR = 'rgba(215, 228, 245, 0.85)' // Warna teks isi paragraf
const DESC_LINE_HEIGHT = 1.68                 // Jarak spasi baris deskripsi paragraf
const TAG_FONT_SIZE = '0.72rem'               // Ukuran font badge tag kecil di atas judul
const TAG_COLOR = '#67e8f9'                   // Warna teks badge tag

// --- Animasi Mengambang (Floating Effect seperti Model 3D) ---
const TEXT_FLOAT_ENABLED = true               // true = teks ikut melayang naik-turun secara organik
const TEXT_FLOAT_AMPLITUDE = 15                // Jarak mengambang naik-turun (px)
const TEXT_FLOAT_DURATION = 4.6               // Durasi satu siklus mengambang (detik). Makin besar = makin tenang & lambat
const TEXT_FLOAT_STAGGER = 0.8                // Selisih jeda mengambang antar elemen (detik) agar tidak serempak kaku

// --- Konten Teks: Content 0 (Golem - Kenapa Memilih Kami / Our Advantages) ---
// Teks KIRI Model Golem
const CONTENT_0_LEFT_PANELS = [
  {
    tag: '01 // HIGH FIDELITY',
    title: 'Design Meets Technology',
    desc: 'We blend creative design with technical expertise to create seamless digital experiences.',
  },
  {
    tag: '02 // INTERACTIVE',
    title: 'Built for Better Interaction',
    desc: 'We create interactive experiences that encourage users to explore, engage, and connect.',
  },
]

// Teks KANAN Model Golem
const CONTENT_0_RIGHT_PANELS = [
  {
    tag: '03 // PERFORMANCE',
    title: 'Purpose-Driven Creativity',
    desc: 'Every detail is designed with intention, balancing creative vision with meaningful results.',
  },
  {
    tag: '04 // IMMERSIVE',
    title: 'Built to Perform like a pro',
    desc: 'We combine visual quality with performance, ensuring every experience feels as good as it looks.',
  },
]

// --- Konten Teks: Content 1 (GolemHand - Hand To Hand) ---
// Teks KIRI Model Tangan Golem
const CONTENT_1_LEFT_PANELS = [
  {
    tag: '01 // SEE FIRST',
    title: 'See First',
    desc: 'We believe that seeing is believing, which is why we offer free consultations to discuss your project needs in detail.',
  },
  {
    tag: '02 // ORGANIC FLOW',
    title: 'Pay Later',
    desc: 'We don\'t require upfront payments. You can see the final result and pay only when you are completely satisfied.',
  },
]

// Teks KANAN Model Tangan Golem
const CONTENT_1_RIGHT_PANELS = [
  {
    tag: '03 // BELIEVE IN   ',
    title: 'Believe in us',
    desc: 'We believe in transparent collaboration. You’re part of the creative process every step of the way.',
  },
  {
    tag: '04 // FUTURE READY',
    title: '3 Months Warranty',
    desc: 'We offer a 3-month warranty on all our projects. If you encounter any issues within the first three months, we’ll fix them for free.',
  },
]



// ========== Three.js Sub-Components ==========

// Pseudo-random deterministik: tata letak batu/debu konsisten tiap kali section dibuka
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Tekstur gradasi radial (dipakai untuk glow lantai, sprite partikel, dan alphaMap lantai)
function makeRadialTexture(stops, size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  stops.forEach(([at, color]) => g.addColorStop(at, color))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Mata golem (di luar komponen utama supaya tidak di-remount)
function EyePart({ node, material, innerRef }) {
  if (!node) return null
  return (
    <mesh
      ref={innerRef}
      name={node.name}
      geometry={node.geometry}
      material={material}
      position={node.position}
      rotation={node.rotation}
      scale={node.scale}
      morphTargetDictionary={node.morphTargetDictionary}
      morphTargetInfluences={node.morphTargetInfluences}
    />
  )
}

// Model golem — animasi "pembatuan" Dr. Stone:
// Scanline naik dari bawah: wireframe hanya tampil di atas scanline,
// solid hanya tampil di bawah scanline. Keduanya bergerak bersamaan.
// Golem dipusatkan lewat bounding box & di-fit ke ukuran target, lalu melayang di atas lantai.
function GolemWhyUs({ hologramProgress, scrollProgRef, entryRef, isMobile }) {
  const { nodes, materials, animations } = useGolemClone()
  const outerRef = useRef()      // grup luar: posisi melayang, rotasi, skala hasil auto-fit
  const centeredRef = useRef()   // grup dalam: kompensasi supaya titik tengah model = origin grup luar
  const layoutRef = useRef({ fit: 1, baseY: 1.5, scanStart: 0, scanEnd: 3.5 })
  const lastOpacityRef = useRef(1)
  const { actions } = useAnimations(animations, centeredRef)

  // Mata mengikuti kursor
  const eyeRightRef = useRef()
  const eyeLeftRef = useRef()
  const eyeBase = useRef({ right: new THREE.Vector3(), left: new THREE.Vector3() })
  const eyeCurrent = useRef(new THREE.Vector3())
  const eyeTarget = useRef(new THREE.Vector3())
  const eyeQuat = useRef(new THREE.Quaternion())
  const pointerRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!EYE_FOLLOW_ENABLED) return
    const onMove = (e) => {
      pointerRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      pointerRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useEffect(() => {
    if (nodes?.matakanan) eyeBase.current.right.copy(nodes.matakanan.position)
    if (nodes?.matakiri) eyeBase.current.left.copy(nodes.matakiri.position)
  }, [nodes])

  // Status jeda antar pengulangan animasi
  const animState = useRef({ playing: true, resumeAt: 0 })

  // Putar animasi alis & mulut golem dari file GLB
  useEffect(() => {
    if (!GOLEM_PLAY_ANIMATION || !actions) return
    animState.current = { playing: true, resumeAt: 0 }
    Object.values(actions).forEach((action) => {
      if (action) {
        if (GOLEM_ANIM_DELAY_SEC > 0) {
          // Sekali putar lalu tahan di pose akhir; useFrame yang memutar ulang setelah jeda
          action.setLoop(THREE.LoopOnce, 1)
          action.clampWhenFinished = true
        }
        action.reset().fadeIn(0.4).play()
        action.setEffectiveTimeScale(GOLEM_ANIM_SPEED)
      }
    })
    return () => {
      Object.values(actions).forEach((action) => action?.stop())
    }
  }, [actions])

  // Efek ombak wireframe (Wave animation) seperti TerrainWaves pada kepala golem
  useModelWaves(centeredRef, {
    color: GOLEM_WAVE_COLOR,
    autoPulse: GOLEM_WAVE_AUTO_PULSE && GOLEM_WAVE_ENABLED,
    pulseInterval: 5.0,
  })

  // ClippingPlane (world space):
  // solidClip: normal (0,-1,0) → lolos jika y <= constant → solid muncul DI BAWAH scanline
  // wireClip:  normal (0, 1,0) → lolos jika y >= -constant → wire muncul DI ATAS scanline
  const solidClip = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), -10))
  const wireClip = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 10))

  // Material wireframe scan (per-instance, bukan shared)
  const wireframeMat = useMemo(() => {
    if (!HOLOGRAM_ENABLED) return null
    return new THREE.MeshBasicMaterial({
      color: HOLOGRAM_WIRE_COLOR,
      wireframe: true,
      transparent: true,
      opacity: HOLOGRAM_WIRE_OPACITY,
      depthWrite: false,
      toneMapped: false,
      clippingPlanes: [wireClip.current],
      clipIntersection: false,
    })
  }, [])

  // Material mata bercahaya
  const eyeMaterial = useMemo(() => {
    const baseMat = materials?.['Material.002'] || (materials && Object.values(materials)[0])
    const mat = baseMat ? baseMat.clone() : new THREE.MeshStandardMaterial()
    mat.transparent = true
    mat.emissive = new THREE.Color(EYE_GLOW_COLOR)
    mat.emissiveIntensity = EYE_GLOW_INTENSITY
    mat.toneMapped = false
    if (HOLOGRAM_ENABLED) mat.clippingPlanes = [solidClip.current]
    return mat
  }, [materials])

  // Pusatkan & fit model. Diukur di ruang lokal grup luar (tidak terpengaruh rotasi/posisi),
  // jadi hasilnya stabil walau scene sudah berputar.
  useLayoutEffect(() => {
    const outer = outerRef.current
    const centered = centeredRef.current
    if (!outer || !centered || !nodes?.kepalaatas) return

    outer.position.set(0, 0, 0)
    outer.rotation.set(0, 0, 0)
    outer.scale.setScalar(1)
    centered.position.set(0, 0, 0)
    outer.updateWorldMatrix(true, false)
    centered.updateWorldMatrix(false, true)

    const inv = new THREE.Matrix4().copy(outer.matrixWorld).invert()
    const box = new THREE.Box3()
    const tmp = new THREE.Box3()
    const m = new THREE.Matrix4()
    centered.traverse((o) => {
      if (!o.isMesh || o.userData.isScanOverlay || o.userData.isWaveOverlay || !o.geometry) return
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
      m.multiplyMatrices(inv, o.matrixWorld)
      tmp.copy(o.geometry.boundingBox).applyMatrix4(m)
      box.union(tmp)
    })
    if (box.isEmpty()) return

    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const target = isMobile ? GOLEM_TARGET_SIZE_MOBILE : GOLEM_TARGET_SIZE
    const fit = (target / maxDim) * GOLEM_SCALE

    centered.position.set(-center.x, -center.y, -center.z)

    const halfDiag = (Math.hypot(size.x, size.y, size.z) * fit) / 2
    // Posisi vertikal pas di tengah layar: sejajar dengan titik tatap kamera (CAMERA_LOOK_Y = 0.85)
    const baseY = CAMERA_LOOK_Y + GOLEM_HEAD_VERTICAL_OFFSET
    layoutRef.current = {
      fit,
      baseY,
      // Rentang scan pembatuan mengikuti ukuran golem sebenarnya
      scanStart: baseY - halfDiag - 0.1,
      scanEnd: baseY + halfDiag + 0.1,
    }
    outer.position.set(0, baseY, 0)
    outer.scale.setScalar(fit)
  }, [nodes, isMobile])

  // Gelapkan batu, buat retakan bercahaya, pasang clipping plane solid
  const tunedMaterials = useRef(new Map())
  useEffect(() => {
    const restore = []
    const cache = tunedMaterials.current
    const tune = (orig) => {
      if (cache.has(orig)) return cache.get(orig)
      const c = orig.clone()
      c.transparent = true
      if (orig.name === CRACK_MATERIAL_NAME) {
        c.emissive = new THREE.Color(CRACK_GLOW_COLOR)
        c.emissiveIntensity = CRACK_GLOW_INTENSITY
        c.toneMapped = false // Bloom threshold bisa mendeteksi glow retakan
      } else if (c.color) {
        c.color.multiplyScalar(STONE_BRIGHTNESS)
      }
      // Solid mesh hanya diclip jika mode hologram diaktifkan
      if (HOLOGRAM_ENABLED) c.clippingPlanes = [solidClip.current]
      cache.set(orig, c)
      return c
    }
      ;[nodes?.kepalaatas, nodes?.mulutbawah, nodes?.alis].forEach((n) => {
        if (!n) return
        n.traverse((o) => {
          if (!o.isMesh || !o.material || o.userData.isWaveOverlay || o.userData.isScanOverlay) return
          restore.push([o, o.material])
          o.material = Array.isArray(o.material) ? o.material.map(tune) : tune(o.material)
        })
      })
    return () => {
      restore.forEach(([o, m]) => { o.material = m })
      cache.forEach((c) => c.dispose())
      cache.clear()
    }
  }, [nodes])

  // Wireframe overlay meshes (hanya di atas scanline)
  const overlayRefs = useRef([])
  useEffect(() => {
    if (!HOLOGRAM_ENABLED || !wireframeMat) return
    const targets = []
      ;[nodes?.kepalaatas, nodes?.mulutbawah, nodes?.alis, nodes?.matakanan, nodes?.matakiri].forEach((n) => {
        if (!n) return
        const collect = (o) => { if (o.isMesh && !o.userData.isWaveOverlay && !o.userData.isScanOverlay) targets.push(o) }
        n.isMesh ? collect(n) : n.traverse(collect)
      })
    const overlays = targets.map((mesh) => {
      const ov = new THREE.Mesh(mesh.geometry, wireframeMat)
      ov.scale.setScalar(1.002)
      ov.renderOrder = 2
      ov.userData.isScanOverlay = true
      ov.raycast = () => { }
      mesh.add(ov)
      return { ov, parent: mesh }
    })
    overlayRefs.current = overlays
    return () => overlays.forEach(({ ov, parent }) => parent.remove(ov))
  }, [nodes, wireframeMat])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const L = layoutRef.current
    const outer = outerRef.current
    if (!outer) return

    // Jeda antar pengulangan animasi alis & mulut: setelah selesai, diam GOLEM_ANIM_DELAY_SEC detik lalu ulang
    if (GOLEM_PLAY_ANIMATION && GOLEM_ANIM_DELAY_SEC > 0 && actions) {
      const list = Object.values(actions).filter(Boolean)
      const st = animState.current
      if (list.length) {
        if (st.playing && !list.some((a) => a.isRunning())) {
          st.playing = false
          st.resumeAt = t + GOLEM_ANIM_DELAY_SEC
        } else if (!st.playing && t >= st.resumeAt) {
          list.forEach((a) => { a.reset(); a.setEffectiveTimeScale(GOLEM_ANIM_SPEED); a.play() })
          st.playing = true
        }
      }
    }

    // Scroll-Driven Animation: posisi & rotasi mengikuti langsung scrollProgress (0.0 .. 1.0)
    const p = scrollProgRef.current

    // Progress kedatangan (0 = belum tiba, 1 = sudah mengendap). Diatur WhyUsScene.
    const e = entryRef.current
    const eIn = 1 - e

    // Culling performa: sembunyikan jika belum tiba atau sudah meluncur jauh ke atas di luar jangkauan kamera
    if (e < 0.003 || p >= 0.995) {
      outer.visible = false
      return
    }

    outer.visible = true

    // Posisi Y: meluncur naik ke atas keluar layar saat discroll + naik dari bawah saat baru tiba
    outer.position.y = L.baseY + Math.sin(t * GOLEM_BOB_SPEED) * GOLEM_BOB_AMPLITUDE + p * GOLEM_TRAVEL_Y + eIn * ENTRY_RISE_FROM

    // Rotasi Y: berputar pada sumbu vertikal mengikuti input scroll secara dinamis (+ putaran mengendap saat tiba)
    outer.rotation.x = GOLEM_ROTATION_X + Math.sin(t * 0.6) * 0.025 + p * SCROLL_SPIN_X
    outer.rotation.y = GOLEM_ROTATION_Y + Math.sin(t * GOLEM_SWAY_SPEED) * GOLEM_SWAY_YAW + p * SCROLL_SPIN_Y - eIn * ENTRY_SPIN_FROM
    outer.rotation.z = GOLEM_ROTATION_Z + Math.sin(t * 0.5) * 0.012

    // Skala mengecil halus saat meluncur ke atas, membesar halus saat baru tiba
    const arrivalScale = ENTRY_SCALE_FROM + (1 - ENTRY_SCALE_FROM) * e
    const currentScale = L.fit * (1 - p * TRAVEL_SCALE_DROP) * arrivalScale
    outer.scale.setScalar(currentScale)

    // Fade-in saat tiba (material memang sudah transparent:true -> tidak memicu kompilasi ulang shader)
    const op = Math.min(1, e * ENTRY_FADE_SPEED)
    if (Math.abs(op - lastOpacityRef.current) > 0.004 || (op >= 1 && lastOpacityRef.current < 1)) {
      lastOpacityRef.current = op
      tunedMaterials.current.forEach((m) => { m.opacity = op })
      eyeMaterial.opacity = op
    }

    // Mata mengikuti kursor: arah kursor di ruang kamera -> diputar ke ruang lokal model
    if (EYE_FOLLOW_ENABLED && centeredRef.current) {
      const ptr = pointerRef.current
      let rx = ptr.x * EYE_MAX_OFFSET
      let ry = -ptr.y * EYE_MAX_OFFSET
      const len = Math.hypot(rx, ry)
      if (len > EYE_MAX_OFFSET) { rx *= EYE_MAX_OFFSET / len; ry *= EYE_MAX_OFFSET / len }
      const tgt = eyeTarget.current.set(rx, ry, 0).applyQuaternion(state.camera.quaternion)
      outer.updateWorldMatrix(true, false)
      centeredRef.current.getWorldQuaternion(eyeQuat.current).invert()
      tgt.applyQuaternion(eyeQuat.current)
      eyeCurrent.current.lerp(tgt, 1 - Math.exp(-EYE_FOLLOW_DAMPING * delta))
      if (eyeRightRef.current) eyeRightRef.current.position.copy(eyeBase.current.right).add(eyeCurrent.current)
      if (eyeLeftRef.current) eyeLeftRef.current.position.copy(eyeBase.current.left).add(eyeCurrent.current)
    }

    // Animasi scanline pembatuan di awal entrance
    const scanP = hologramProgress.current // 0 → 1
    const totalRange = L.scanEnd - L.scanStart
    const solidY = L.scanStart + scanP * totalRange
    const wireY = L.scanStart + Math.min(1, scanP + SCAN_WIRE_LEAD) * totalRange
    solidClip.current.constant = solidY
    wireClip.current.constant = -wireY

    // Wireframe fade hanya saat entrance pembatuan
    if (wireframeMat) {
      wireframeMat.opacity = HOLOGRAM_WIRE_OPACITY * Math.max(0, 1 - Math.pow(scanP, 3))
      wireframeMat.visible = scanP < 0.98
    }

    // Napas mata: saat hologram off, langsung nyala penuh (tanpa multiplier scanP)
    const breathe = 1 + Math.sin(t * 1.4) * 0.08
    const scanFactor = HOLOGRAM_ENABLED ? Math.min(1, scanP * 2) : 1
    eyeMaterial.emissiveIntensity = EYE_GLOW_INTENSITY * breathe * scanFactor
  })

  return (
    <group ref={outerRef} rotation={[GOLEM_ROTATION_X, GOLEM_ROTATION_Y, GOLEM_ROTATION_Z]}>
      <group ref={centeredRef}>
        {nodes.kepalaatas && <primitive object={nodes.kepalaatas} />}
        {nodes.mulutbawah && <primitive object={nodes.mulutbawah} />}
        {nodes.alis && <primitive object={nodes.alis} />}
        <EyePart node={nodes.matakanan} material={eyeMaterial} innerRef={eyeRightRef} />
        <EyePart node={nodes.matakiri} material={eyeMaterial} innerRef={eyeLeftRef} />
      </group>
    </group>
  )
}

// Model tangan golem (/golemhand.glb) — Content 1
// Dipusatkan lewat bounding box & di-fit ke ukuran target, melayang di scene yang sama dengan batu-batu orbit
function GolemHandModel({ scrollProgRef, entryRef, isMobile }) {
  const outerRef = useRef()
  const centeredRef = useRef()
  const layoutRef = useRef({ fit: 1 })
  const handMatsRef = useRef([])
  const lastOpacityRef = useRef(1)
  const animState = useRef({ playing: true, resumeAt: 0 })
  const { scene, animations } = useGLTF('/golemhand.glb')
  const { actions } = useAnimations(animations, outerRef)

  // Efek ombak wireframe (Wave animation) seperti TerrainWaves pada tangan golem
  useModelWaves(centeredRef, {
    color: GOLEMHAND_WAVE_COLOR,
    autoPulse: GOLEMHAND_WAVE_AUTO_PULSE && GOLEM_WAVE_ENABLED,
    pulseInterval: 5.5,
  })

  // Mainkan animasi gerak jari tangan dari file GLB jika ada
  useEffect(() => {
    if (!GOLEMHAND_PLAY_ANIMATION || !actions) return
    animState.current = { playing: true, resumeAt: 0 }
    Object.values(actions).forEach((action) => {
      if (action) {
        if (GOLEMHAND_ANIM_DELAY_SEC > 0) {
          action.setLoop(THREE.LoopOnce, 1)
          action.clampWhenFinished = true
        }
        action.reset().fadeIn(0.5).play()
        action.setEffectiveTimeScale(GOLEMHAND_ANIM_SPEED)
      }
    })
    return () => {
      Object.values(actions).forEach((action) => action?.stop())
    }
  }, [actions])

  // Tuning material: glow retakan cyan. transparent:true dipasang SEKALI di awal (bukan di-toggle
  // saat animasi) supaya fade-in kedatangan tidak memicu kompilasi ulang shader di tengah gerak.
  useEffect(() => {
    handMatsRef.current = []
    scene.traverse((o) => {
      if (o.isMesh && o.material) {
        const prepareMat = (m) => {
          m.transparent = true
          m.opacity = 1
          handMatsRef.current.push(m)
          if (m.name === 'Material.005' || m.name === 'bluerift') {
            m.emissive = new THREE.Color(GOLEMHAND_CRACK_GLOW_COLOR)
            m.emissiveIntensity = GOLEMHAND_CRACK_GLOW_INTENSITY
            m.toneMapped = false // Penting agar bloom threshold bisa mendeteksi emissive glow
          }
        }
        if (Array.isArray(o.material)) {
          o.material.forEach(prepareMat)
        } else {
          prepareMat(o.material)
        }
      }
    })
  }, [scene])

  // Auto-fit & auto-center bounding box
  useLayoutEffect(() => {
    const centered = centeredRef.current
    if (!centered) return

    centered.position.set(0, 0, 0)
    centered.rotation.set(0, 0, 0)
    centered.scale.setScalar(1)
    centered.updateWorldMatrix(true, true)

    const box = new THREE.Box3().setFromObject(centered)
    if (box.isEmpty()) return

    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const targetSize = isMobile ? GOLEMHAND_MODEL_SIZE_MOBILE : GOLEMHAND_MODEL_SIZE
    const fit = (targetSize / maxDim) * GOLEMHAND_MODEL_SCALE

    centered.position.set(-center.x, -center.y, -center.z)
    layoutRef.current = { fit }

    if (outerRef.current) {
      outerRef.current.position.set(0, GOLEMHAND_MODEL_Y - GOLEMHAND_TRAVEL_Y, 0)
      outerRef.current.scale.setScalar(fit * (1 - TRAVEL_SCALE_DROP))
      outerRef.current.visible = false
    }
  }, [scene, isMobile])

  useFrame((state) => {
    const outer = outerRef.current
    if (!outer) return

    const t = state.clock.elapsedTime

    // Jeda antar pengulangan animasi gerak jari tangan
    if (GOLEMHAND_PLAY_ANIMATION && GOLEMHAND_ANIM_DELAY_SEC > 0 && actions) {
      const list = Object.values(actions).filter(Boolean)
      const st = animState.current
      if (list.length) {
        if (st.playing && !list.some((a) => a.isRunning())) {
          st.playing = false
          st.resumeAt = t + GOLEMHAND_ANIM_DELAY_SEC
        } else if (!st.playing && t >= st.resumeAt) {
          list.forEach((a) => { a.reset(); a.setEffectiveTimeScale(GOLEMHAND_ANIM_SPEED); a.play() })
          st.playing = true
        }
      }
    }

    // Scroll-Driven Animation: posisi & rotasi mengikuti langsung scrollProgress (0.0 .. 1.0)
    const p = scrollProgRef.current

    const e = entryRef.current
    const eIn = 1 - e

    // Culling performa: sembunyikan jika belum tiba atau masih jauh di bawah layar
    if (e < 0.003 || p <= 0.005) {
      outer.visible = false
      return
    }

    outer.visible = true
    const factor = 1 - p
    const fit = layoutRef.current.fit || 1

    // Posisi Y: meluncur naik dari bawah layar ke posisi tengah panggung (+ naik halus saat baru tiba)
    outer.position.y = GOLEMHAND_MODEL_Y + Math.sin(t * GOLEMHAND_BOB_SPEED) * GOLEMHAND_BOB_AMPLITUDE - factor * GOLEMHAND_TRAVEL_Y + eIn * ENTRY_RISE_FROM

    // Rotasi Y: berputar pada sumbu vertikal mengikuti input scroll secara dinamis (+ putaran mengendap saat tiba)
    outer.rotation.y = GOLEMHAND_MODEL_ROT_Y - factor * SCROLL_SPIN_Y - eIn * ENTRY_SPIN_FROM
    outer.rotation.x = GOLEMHAND_MODEL_ROT_X - factor * SCROLL_SPIN_X
    outer.rotation.z = GOLEMHAND_MODEL_ROT_Z

    // Skala membesar ke normal saat sampai di tengah panggung (+ membesar halus saat baru tiba)
    const arrivalScale = ENTRY_SCALE_FROM + (1 - ENTRY_SCALE_FROM) * e
    const currentScale = fit * (1 - factor * TRAVEL_SCALE_DROP) * arrivalScale
    outer.scale.setScalar(currentScale)

    // Fade-in saat tiba
    const op = Math.min(1, e * ENTRY_FADE_SPEED)
    if (Math.abs(op - lastOpacityRef.current) > 0.004 || (op >= 1 && lastOpacityRef.current < 1)) {
      lastOpacityRef.current = op
      handMatsRef.current.forEach((m) => { m.opacity = op })
    }
  })

  return (
    <group ref={outerRef} visible={false}>
      <group ref={centeredRef}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

// Hotspot satu batu: dot kecil + teks di atasnya (elemen DOM lewat drei <Html>). Opacity diatur per frame lewat ref.
// Gaya ada di SectionWhyUs.css (.rock-hotspot).
function RockHotspot({ label, position, domRef, isMobile }) {
  return (
    <Html position={position} zIndexRange={[ROCK_HOTSPOT_Z_INDEX, 0]} style={{ pointerEvents: 'none' }}>
      <div
        ref={domRef}
        className="rock-hotspot"
        style={{
          opacity: 0,
          '--rh-dot': `${ROCK_HOTSPOT_DOT_SIZE}px`,
          '--rh-color': ROCK_HOTSPOT_DOT_COLOR,
          '--rh-text-size': `${isMobile ? ROCK_HOTSPOT_TEXT_SIZE_MOBILE : ROCK_HOTSPOT_TEXT_SIZE}px`,
          '--rh-text-color': ROCK_HOTSPOT_TEXT_COLOR,
          '--rh-text-bg': ROCK_HOTSPOT_TEXT_BG,
          '--rh-gap': `${ROCK_HOTSPOT_TEXT_GAP}px`,
        }}
      >
        <span className="rock-hotspot__text">{label}</span>
        <span className={`rock-hotspot__dot${ROCK_HOTSPOT_RING_PULSE ? ' rock-hotspot__dot--pulse' : ''}`} />
      </div>
    </Html>
  )
}

// Batu/meteorit mengambang (PLACEHOLDER) — mengorbit golem, flat-shaded dengan glow kristal samar
function FloatingRocks({ entryRef, isMobile }) {
  const rocksData = useMemo(() => {
    const rand = mulberry32(35)
    const data = []
    for (let i = 0; i < ROCK_COUNT; i++) {
      const angle = (i / ROCK_COUNT) * Math.PI * 2 + (rand() - 0.5) * 0.5
      const radius = ROCK_RADIUS_MIN + rand() * (ROCK_RADIUS_MAX - ROCK_RADIUS_MIN)
      const y = ROCK_Y_MIN + rand() * (ROCK_Y_MAX - ROCK_Y_MIN)
      data.push({
        position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
        baseY: y,
        size: ROCK_SIZE_MIN + Math.pow(rand(), 1.6) * (ROCK_SIZE_MAX - ROCK_SIZE_MIN),
        squash: [1, 0.65 + rand() * 0.6, 0.8 + rand() * 0.5],
        phase: rand() * Math.PI * 2,
        speed: ROCK_FLOAT_SPEED * (0.7 + rand() * 0.6),
        rotSpeed: (rand() - 0.5) * 0.6,
      })
    }
    return data
  }, [])

  const geometry = useMemo(() => new THREE.DodecahedronGeometry(1, 0), [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: ROCK_COLOR,
        emissive: ROCK_EMISSIVE,
        emissiveIntensity: 0.55,
        roughness: 0.8,
        metalness: 0.25,
        flatShading: true,
      }),
    []
  )
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])

  const refs = useRef([])      // grup posisi (naik-turun), TIDAK berputar -> hotspot tetap tegak
  const rotRefs = useRef([])   // grup putar: hanya mesh batu yang berputar
  const domRefs = useRef([])   // elemen DOM hotspot per batu

  // Peta nomor batu -> label hotspot
  const labels = useMemo(() => {
    const m = new Map()
    if (ROCK_HOTSPOTS_ENABLED && !(isMobile && ROCK_HOTSPOT_HIDE_ON_MOBILE)) {
      ROCK_HOTSPOTS.forEach((h) => { if (h.rock >= 0 && h.rock < ROCK_COUNT) m.set(h.rock, h.label) })
    }
    return m
  }, [isMobile])

  const tmp = useRef({
    wp: new THREE.Vector3(),
    np: new THREE.Vector3(),
    gn: new THREE.Vector3(),
    golem: new THREE.Vector3(0, CAMERA_LOOK_Y, 0),
  })

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    refs.current.forEach((grp, i) => {
      if (!grp) return
      const rock = rocksData[i]
      grp.position.y = rock.baseY + Math.sin(t * rock.speed + rock.phase) * ROCK_FLOAT_AMPLITUDE
      const rg = rotRefs.current[i]
      if (rg) {
        rg.rotation.x += rock.rotSpeed * delta * 0.6
        rg.rotation.z += rock.rotSpeed * delta * 0.45
      }
    })

    // Hotspot: ikut fade-in saat golem tiba, dan memudar bila batu ada DI BELAKANG golem (terhalang)
    if (labels.size) {
      const cam = state.camera
      const T = tmp.current
      const arrive = entryRef ? Math.min(1, entryRef.current * ENTRY_FADE_SPEED) : 1
      const camToGolem = cam.position.distanceTo(T.golem)
      const aspect = state.size.width / Math.max(1, state.size.height)
      T.gn.copy(T.golem).project(cam)
      labels.forEach((_, i) => {
        const grp = refs.current[i]
        const el = domRefs.current[i]
        if (!grp || !el) return
        grp.getWorldPosition(T.wp)
        const behind = THREE.MathUtils.smoothstep(
          cam.position.distanceTo(T.wp) - camToGolem,
          ROCK_HOTSPOT_BEHIND_MARGIN,
          ROCK_HOTSPOT_BEHIND_MARGIN + ROCK_HOTSPOT_BEHIND_FADE
        )
        T.np.copy(T.wp).project(cam)
        const dist = Math.hypot((T.np.x - T.gn.x) * aspect * 0.5, (T.np.y - T.gn.y) * 0.5)
        const clear = THREE.MathUtils.smoothstep(dist, ROCK_HOTSPOT_OCCLUDE_RADIUS, ROCK_HOTSPOT_OCCLUDE_RADIUS + ROCK_HOTSPOT_OCCLUDE_FEATHER)
        const offscreen = T.np.z > 1 ? 0 : 1
        const vis = (1 - behind * (1 - clear)) * arrive * offscreen
        el.style.opacity = vis < 0.01 ? '0' : vis.toFixed(3)
      })
    }
  })

  return (
    <>
      {rocksData.map((rock, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el }} position={rock.position}>
          <group ref={(el) => { rotRefs.current[i] = el }}>
            <mesh geometry={geometry} material={material} scale={[rock.size * rock.squash[0], rock.size * rock.squash[1], rock.size * rock.squash[2]]} />
          </group>
          {labels.has(i) && (
            <RockHotspot
              label={labels.get(i)}
              position={[0, rock.size * rock.squash[1] * ROCK_HOTSPOT_ANCHOR_Y, 0]}
              domRef={(el) => { domRefs.current[i] = el }}
              isMobile={isMobile}
            />
          )}
        </group>
      ))}
    </>
  )
}

// Debu kosmik: partikel kecil bercahaya yang naik pelan dari lantai, memberi kedalaman & suasana
function DustMotes({ isMobile }) {
  const count = isMobile ? DUST_COUNT_MOBILE : DUST_COUNT
  const pointsRef = useRef()

  const { positions, speeds, drift, colors } = useMemo(() => {
    const rand = mulberry32(77)
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const spd = new Float32Array(count)
    const drf = new Float32Array(count)
    const palette = ['#7dd3fc', '#e0f2fe', '#c4b5fd', '#ffffff', '#67e8f9'].map((c) => new THREE.Color(c))
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (rand() - 0.5) * 2 * DUST_SPREAD_X
      pos[i * 3 + 1] = rand() * DUST_HEIGHT
      pos[i * 3 + 2] = (rand() - 0.5) * 2 * DUST_SPREAD_Z
      spd[i] = 0.05 + rand() * 0.17
      drf[i] = rand() * Math.PI * 2
      const c = palette[Math.floor(rand() * palette.length)]
      col[i * 3 + 0] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    return { positions: pos, speeds: spd, drift: drf, colors: col }
  }, [count])

  const sprite = useMemo(
    () => makeRadialTexture([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']], 64),
    []
  )
  useEffect(() => () => sprite.dispose(), [sprite])

  useFrame((state, delta) => {
    const pts = pointsRef.current
    if (!pts) return
    const t = state.clock.elapsedTime
    const attr = pts.geometry.attributes.position
    const arr = attr.array
    for (let i = 0; i < count; i++) {
      let y = arr[i * 3 + 1] + speeds[i] * delta
      if (y > DUST_HEIGHT) y = 0.05
      arr[i * 3 + 1] = y
      arr[i * 3] += Math.sin(t * 0.4 + drift[i]) * 0.04 * delta
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={pointsRef} renderOrder={4} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={DUST_SIZE}
        map={sprite}
        vertexColors
        transparent
        opacity={0.75}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </points>
  )
}

// Kolam energi di lantai tepat di bawah golem: glow bernapas + cincin riak yang melebar & memudar
function EnergyPool() {
  const glowRef = useRef()
  const ringRefs = useRef([])

  const glowTex = useMemo(
    () => makeRadialTexture([[0, POOL_COLOR_CORE], [0.35, POOL_COLOR_MID], [1, 'rgba(0,0,0,0)']]),
    []
  )
  useEffect(() => () => glowTex.dispose(), [glowTex])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (glowRef.current) glowRef.current.material.opacity = 0.62 + Math.sin(t * 1.3) * 0.12
    ringRefs.current.forEach((ring, i) => {
      if (!ring) return
      const p = (t / RIPPLE_PERIOD + i / RIPPLE_COUNT) % 1
      ring.scale.setScalar(0.5 + p * RIPPLE_MAX_SCALE)
      // fade-in cepat di awal, fade-out halus di akhir
      ring.material.opacity = Math.pow(1 - p, 2) * Math.min(1, p * 6) * 0.55
    })
  })

  return (
    <group position={[0, 0.02, 0]}>
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <circleGeometry args={[POOL_RADIUS, 64]} />
        <meshBasicMaterial
          map={glowTex}
          transparent
          opacity={0.62}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
      {Array.from({ length: RIPPLE_COUNT }).map((_, i) => (
        <mesh key={i} ref={(el) => { ringRefs.current[i] = el }} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
          <ringGeometry args={[0.96, 1, 96]} />
          <meshBasicMaterial
            color={RIPPLE_COLOR}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      ))}
    </group>
  )
}

// Panggung kaca: slab transparan berbingkai cahaya, duduk di atas lantai reflektif
function GlassPlatform() {
  return (
    <group>
      {/* Tubuh kaca (permukaan atas di y ≈ 0.01) */}
      <mesh position={[0, 0.01 - PLATFORM_THICKNESS / 2, 0]} renderOrder={1}>
        <cylinderGeometry args={[PLATFORM_RADIUS, PLATFORM_RADIUS, PLATFORM_THICKNESS, 96, 1]} />
        <meshPhysicalMaterial
          color={PLATFORM_COLOR}
          transparent
          opacity={PLATFORM_OPACITY}
          roughness={0.05}
          metalness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.05}
          envMapIntensity={1}
          depthWrite={false}
        />
      </mesh>
      {/* Garis cahaya tipis di tepi panggung */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} renderOrder={3}>
        <ringGeometry args={[PLATFORM_RADIUS - 0.035, PLATFORM_RADIUS, 128]} />
        <meshBasicMaterial
          color={new THREE.Color(PLATFORM_RIM_COLOR).multiplyScalar(PLATFORM_RIM_INTENSITY)}
          toneMapped={false}
          transparent
          opacity={0.95}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

// Lantai kaca reflektif: memantulkan golem, batu & cahaya. Tepi jauh dilebur fog (tanpa horizon keras).
function GlassFloor({ isMobile }) {
  return (
    <group>
      {POOL_ENABLED && <EnergyPool />}
      {PLATFORM_ENABLED && <GlassPlatform />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <planeGeometry args={[GLASS_FLOOR_SIZE, GLASS_FLOOR_SIZE, 1, 1]} />
        <MeshReflectorMaterial
          color={GLASS_FLOOR_COLOR}
          roughness={GLASS_FLOOR_ROUGHNESS}
          metalness={GLASS_FLOOR_METALNESS}
          mirror={GLASS_FLOOR_REFLECTIVITY}
          resolution={isMobile ? GLASS_FLOOR_RESOLUTION_MOBILE : GLASS_FLOOR_RESOLUTION}
          blur={GLASS_FLOOR_BLUR}
          mixBlur={GLASS_FLOOR_MIX_BLUR}
          mixStrength={GLASS_FLOOR_MIX_STRENGTH}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
        />
      </mesh>
    </group>
  )
}

// Orbit: memutar batu-batu horisontal mengelilingi golem
function Turntable({ children }) {
  const groupRef = useRef()
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += TURNTABLE_SPEED * delta
  })
  return <group ref={groupRef}>{children}</group>
}

// Kamera sinematik: dolly-in saat entrance (mengikuti progress pembatuan),
// lalu melayang pelan + parallax mengikuti kursor. Otomatis menjauh di layar sempit supaya
// golem tidak terpotong.
function CameraRig({ hologramProgress }) {
  const pointer = useRef({ x: 0, y: 0 })
  const smooth = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      pointer.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame((state, delta) => {
    const cam = state.camera
    const p = hologramProgress.current
    const ease = 1 - Math.pow(1 - Math.min(1, p * 1.05), 3) // easeOutCubic

    const fov = THREE.MathUtils.degToRad(cam.fov)
    const aspect = state.size.width / Math.max(1, state.size.height)
    const fitDist = CAMERA_FIT_WIDTH / (2 * Math.tan(fov / 2) * aspect)
    const endDist = Math.max(CAMERA_END_DISTANCE, fitDist)
    const dist = THREE.MathUtils.lerp(endDist + CAMERA_DOLLY_DISTANCE, endDist, ease)

    const k = 1 - Math.exp(-3 * delta)
    smooth.current.x += (pointer.current.x - smooth.current.x) * k
    smooth.current.y += (pointer.current.y - smooth.current.y) * k

    const drift = Math.sin(state.clock.elapsedTime * 0.18) * 0.25
    cam.position.set(
      smooth.current.x * CAMERA_PARALLAX_X + drift,
      CAMERA_HEIGHT + (1 - ease) * 0.6 - smooth.current.y * CAMERA_PARALLAX_Y,
      dist
    )
    cam.lookAt(0, CAMERA_LOOK_Y, 0)
  })

  return null
}

// Scene utama di dalam Canvas
// clippingPlanes diaktifkan di renderer agar clippingPlane material bekerja
function WhyUsScene({ hologramProgress, scrollProgRef, targetProgRef, entryRef, sectionDomRef, isMobile, isContentEntered }) {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    gl.localClippingEnabled = true
    return () => { gl.localClippingEnabled = false }
  }, [gl])

  // [BARU] Pemanasan shader: kompilasi semua material scene (termasuk Golem/Tangan yang masih
  // disembunyikan) SEBELUM dibutuhkan. Tanpa ini, kompilasi baru terjadi di frame pertama model
  // tampil -> patah/hitch tepat saat Golem muncul. try/catch: tidak semua build three punya compileAsync.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const r = gl.compileAsync ? gl.compileAsync(scene, camera) : gl.compile(scene, camera)
        if (r && typeof r.catch === 'function') r.catch(() => { })
      } catch { /* abaikan: hanya optimasi */ }
    }, 500)
    return () => clearTimeout(id)
  }, [gl, scene, camera])

  // Scroll-Driven Animation Loop: interpolasi scrollProgress dengan lerp damping 60-120fps
  useFrame((state, delta) => {
    // Kedatangan model: peluruhan eksponensial berbasis waktu menuju 1 (tiba) / 0 (belum)
    const entryTarget = isContentEntered ? 1 : 0
    let e = entryRef.current + (entryTarget - entryRef.current) * (1 - Math.exp(-ENTRY_DAMP_RATE * delta))
    if (Math.abs(e - entryTarget) < 0.002) e = entryTarget
    entryRef.current = e

    // Lerp smooth scroll progres (0.0 .. 1.0) — berbasis waktu juga (bukan faktor per-frame)
    scrollProgRef.current += (targetProgRef.current - scrollProgRef.current) * (1 - Math.exp(-SCROLL_LERP_SPEED * delta))

    // Update CSS custom property pada container DOM secara langsung (zero re-render!)
    if (sectionDomRef.current) {
      sectionDomRef.current.style.setProperty('--scroll-p', scrollProgRef.current.toFixed(4))
    }
  })

  return (
    <>
      <CameraRig hologramProgress={hologramProgress} />

      {/* Fog: melebur tepi jauh lantai ke warna cakrawala */}
      <fog attach="fog" args={[FLOOR_FOG_COLOR, FLOOR_FOG_NEAR, FLOOR_FOG_FAR]} />

      {/* Multi-Point Dynamic Lighting */}
      {MULTI_LIGHTS.map((light, i) => (
        <pointLight
          key={i}
          position={light.position}
          color={light.color}
          intensity={light.intensity}
          distance={light.distance}
          decay={2}
        />
      ))}

      {/* Rim light cyan untuk siluet golem & tangan */}
      <directionalLight position={[0, 4, -4]} color="#00f0ff" intensity={1.2} />

      {/* Ambient agar golem tetap terbaca */}
      <ambientLight color="#1a2a4a" intensity={1.2} />

      {/* Lantai kaca STATIS — tidak ikut berputar */}
      {GLASS_FLOOR_ENABLED && <GlassFloor isMobile={isMobile} />}

      {/* Golem melayang di tengah (Content 0) — Scroll-Driven */}
      <Suspense fallback={null}>
        <GolemWhyUs
          hologramProgress={hologramProgress}
          scrollProgRef={scrollProgRef}
          entryRef={entryRef}
          isMobile={isMobile}
        />
      </Suspense>

      {/* Model tangan Golem (Content 1) — Scroll-Driven */}
      <Suspense fallback={null}>
        <GolemHandModel
          scrollProgRef={scrollProgRef}
          entryRef={entryRef}
          isMobile={isMobile}
        />
      </Suspense>

      {/* Batu mengorbit golem (TETAP ADA & BERPUTAR DI KEDUA KONTEN!) */}
      {ROCKS_ENABLED && (
        <Turntable>
          <FloatingRocks entryRef={entryRef} isMobile={isMobile} />
        </Turntable>
      )}

      {/* Debu kosmik (TETAP ADA DI KEDUA KONTEN!) */}
      {DUST_ENABLED && <DustMotes isMobile={isMobile} />}

      {/* Bloom efek glow */}
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={BLOOM_INTENSITY}
          luminanceThreshold={BLOOM_THRESHOLD}
          luminanceSmoothing={BLOOM_SMOOTHING}
          radius={BLOOM_RADIUS}
        />
      </EffectComposer>
    </>
  )
}


// ========== Star Generator (CSS) ==========
function generateStars(count) {
  const stars = []
  for (let i = 0; i < count; i++) {
    stars.push({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      dur: `${2 + Math.random() * 4}s`,
      delay: `${Math.random() * 3}s`,
      brightness: 0.3 + Math.random() * 0.7,
      size: 1 + Math.random() * 2,
    })
  }
  return stars
}

// ========== Glitch Text Generator ==========
function generateGlitchTexts(count) {
  const texts = []
  for (let i = 0; i < count; i++) {
    texts.push({
      id: i,
      text: GLITCH_TEXTS[Math.floor(Math.random() * GLITCH_TEXTS.length)],
      left: `${5 + Math.random() * 85}%`,
      top: `${5 + Math.random() * 85}%`,
      dur: `${5 + Math.random() * 8}s`,
      delay: `${Math.random() * 5}s`,
      opacity: 0.03 + Math.random() * 0.05,
      rotate: `${(Math.random() - 0.5) * 20}deg`,
    })
  }
  return texts
}


// ========== Main Component ==========
// Props:
//  isVisible        : Section 3.5 aktif penuh (activeSection === 3.5, bukan sedang sapuan balik)
//  isPreview        : gelombang sedang menyapu (entering / returning) -> section tampil di balik Section 3
//  phase            : frostPhase dari App ('none' | 'entering' | 'inside' | 'returning')
//  is2D             : sheet putih (Section 4/5) sedang/sudah naik
//  entrySide        : 'above' (dari Section 3) | 'below' (kembali dari sheet 2D)
//  sheetDurationMs  : durasi sheet naik (selaras CSS) — dipakai untuk efek "mundur" di bawah sheet
const SectionWhyUs = forwardRef(function SectionWhyUs(
  { isVisible, onBack, onNext, onScrubBack, isPreview = false, phase = 'none', is2D = false, entrySide = 'above', sheetDurationMs = 1000 },
  ref
) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960
  const isExitingRef = useRef(false)
  const sectionDomRef = useRef(null)

  // Status kesiapan konten: konten disembunyikan sampai gelombang tiba di kanan atas (bukan preview)
  const [isContentEntered, setIsContentEntered] = useState(false)
  const [isContentEntering, setIsContentEntering] = useState(false)
  const [activeContent, setActiveContent] = useState(0) // 0 = Golem, 1 = GolemHand
  const isContentEnteredRef = useRef(false)
  const contentEnteredAtRef = useRef(0)
  const boundaryHitTimeRef = useRef(0)
  const entrySideRef = useRef(entrySide)
  entrySideRef.current = entrySide

  // Scroll-Driven Animation state & refs (200vh total feel)
  const targetProgRef = useRef(0)        // 0.0 .. 1.0 (target dari input scroll)
  const scrollProgRef = useRef(0)        // 0.0 .. 1.0 (smooth interpolated)
  const entryProgRef = useRef(0)         // 0.0 .. 1.0 (kedatangan model: naik, membesar, fade-in)
  const overshootRef = useRef(0)         // Akumulasi scroll saat sudah mentok di 0 atau 1
  const hologramProgress = useRef(0)
  const hologramStartTime = useRef(null)

  // Generate stars & glitch once
  const stars = useMemo(() => generateStars(STAR_COUNT), [])
  const glitchTexts = useMemo(() => generateGlitchTexts(GLITCH_COUNT), [])

  // [BARU] Saat sheet 2D naik, Section 3.5 TIDAK dihilangkan: ia "mundur" (mengecil & meredup)
  // di bawah sheet, dan baru dilepas setelah sheet menutup penuh. Dulu konten dihapus seketika +
  // 220ms layar kosong + canvas dibekukan sebelum sheet mulai naik.
  const [receded, setReceded] = useState(false)
  useEffect(() => {
    if (!is2D) {
      setReceded(false)
      return undefined
    }
    const t = setTimeout(() => setReceded(true), sheetDurationMs + 150)
    return () => clearTimeout(t)
  }, [is2D, sheetDurationMs])

  const isReturning = phase === 'returning'

  // [KABUT SCROLL] Selama gesture kabut (phase 'entering' | 'returning'), Section 3.5 menjadi LEMBAR yang
  // menimpa Section 3: transform-nya digeser imperatif lewat setSheetY (kabut menyatu di tepi atasnya).
  // `sheetOwned` = lembar sedang dikendalikan inline (bukan class). Setelah gesture selesai dan 3.5 tidak
  // terlihat, ia tetap tersembunyi (visibility hidden) agar tidak ada "hantu" fade saat kembali ke class biasa.
  const veilActive = phase === 'entering' || phase === 'returning'
  const sheetYRef = useRef(0)
  const [sheetOwned, setSheetOwned] = useState(false)
  if (veilActive && !sheetOwned) setSheetOwned(true)
  // [FIX "lock"] Dulu begitu kabut selesai, kepemilikan inline dilepas SEKETIKA & kelas CSS mengambil alih
  // (transform/opacity/transition/z-index berganti dalam satu frame => terasa tersentak/terkunci saat tiba di 3.5).
  // Sekarang bila 3.5 tiba LEWAT kabut, gaya inline (translate 0, opacity 1) dipertahankan apa adanya —
  // tidak ada perubahan visual sama sekali di momen serah-terima. Dilepas baru saat sheet 2D naik atau 3.5 ditinggalkan.
  const arrivedViaVeilRef = useRef(false)
  useLayoutEffect(() => {
    if (veilActive) { arrivedViaVeilRef.current = true; return }
    // [FIX] Sheet 2D naik (Section 4): isVisible sudah false, tapi 3.5 harus tetap tampil "mundur" di bawah sheet.
    // Lepas kepemilikan inline SEKARANG (gaya inline berisi visibility hidden bila isVisible false) agar kelas CSS
    // `--behind` yang mengatur recede. Hanya bila 3.5 tadi tiba lewat kabut; jalur lain tidak berubah.
    if (is2D) {
      if (sheetOwned && arrivedViaVeilRef.current) {
        sheetYRef.current = 0
        setSheetOwned(false)
      }
      arrivedViaVeilRef.current = false
      return
    }
    if (!isVisible) { arrivedViaVeilRef.current = false; return }
    if (sheetOwned && !arrivedViaVeilRef.current) {
      sheetYRef.current = 0
      setSheetOwned(false)
    }
  }, [veilActive, sheetOwned, isVisible, is2D])
  const behindSheet = is2D && !receded
  // Selama ombak menyapu balik ke Section 3 ATAU sheet masih naik, konten dipertahankan apa adanya
  // (tertutup oleh ombak / sheet), bukan di-reset lebih dulu.
  const holdContent = isReturning || behindSheet

  // Kemunculan konten: LANGSUNG tampil penuh (tanpa jeda & tanpa animasi masuk) — model Golem dan teks
  // sudah ada sejak lembar 3.5 mulai naik menimpa Section 3 (phase 'entering'), bukan menunggu setelah selesai.
  const showContentNow = (isVisible || phase === 'entering') && !isPreview
  useEffect(() => {
    if (showContentNow) {
      isExitingRef.current = false
      if (!isContentEnteredRef.current) {
        // Datang dari bawah (kembali dari sheet): mulai di konten terakhir
        const startP = RETURN_FROM_SHEET_TO_LAST_CONTENT && entrySideRef.current === 'below' ? 1 : 0
        targetProgRef.current = startP
        scrollProgRef.current = startP
        entryProgRef.current = 1   // model langsung di posisi akhir (tanpa naik/membesar/memutar/fade)
        setActiveContent(startP)
        if (sectionDomRef.current) sectionDomRef.current.style.setProperty('--scroll-p', String(startP))
      }
      isContentEnteredRef.current = true
      contentEnteredAtRef.current = performance.now()
      setIsContentEntering(false)
      setIsContentEntered(true)
      return undefined
    }

    if (holdContent) return undefined

    // Reset penuh (hanya saat benar-benar tidak terlihat & tidak sedang tertutup ombak/sheet)
    isContentEnteredRef.current = false
    setIsContentEntered(false)
    setIsContentEntering(false)
    setActiveContent(0)
    targetProgRef.current = 0
    scrollProgRef.current = 0
    entryProgRef.current = 0
    overshootRef.current = 0
    boundaryHitTimeRef.current = 0
    isExitingRef.current = false
    if (sectionDomRef.current) {
      sectionDomRef.current.style.setProperty('--scroll-p', '0')
    }
    return undefined
  }, [showContentNow, isPreview, holdContent])

  // Hologram entrance animation timing
  useEffect(() => {
    if (isVisible && !isPreview && HOLOGRAM_ENABLED) {
      hologramProgress.current = 0
      hologramStartTime.current = performance.now()
      const animate = () => {
        if (!hologramStartTime.current) return
        const elapsed = (performance.now() - hologramStartTime.current) / 1000
        hologramProgress.current = Math.min(1, elapsed / HOLOGRAM_DURATION_SEC)
        if (hologramProgress.current < 1) {
          requestAnimationFrame(animate)
        }
      }
      requestAnimationFrame(animate)
    } else {
      hologramProgress.current = 0
      hologramStartTime.current = null
    }
  }, [isVisible, isPreview])

  // Satu jalur untuk wheel & touch: geser progress, deteksi mentok, lalu keluar setelah overshoot.
  // [PERBAIKAN] Keluar TIDAK lagi menyembunyikan konten + menunggu 220ms. onBack/onNext dipanggil
  // langsung: ombak (ke Section 3) atau sheet (ke Section 4) mengambil alih, dan konten yang masih
  // utuh itulah yang tertutup/mundur — satu gerakan menyambung, bukan "hilang -> kosong -> baru".
  const applyDelta = useCallback((delta) => {
    if (isExitingRef.current || !isContentEnteredRef.current) return
    const now = performance.now()
    if (now - contentEnteredAtRef.current < ARRIVAL_INPUT_LOCK_MS) return

    const prev = targetProgRef.current
    const next = Math.max(0, Math.min(1, prev + delta / SCROLL_DISTANCE_PX))

    // Deteksi jika baru saja mencapai batas (prev berada di tengah lalu menyentuh 0 atau 1)
    if ((prev > 0.001 && next <= 0.001) || (prev < 0.999 && next >= 0.999)) {
      boundaryHitTimeRef.current = now
      overshootRef.current = 0
      targetProgRef.current = next
      return
    }

    targetProgRef.current = next

    // Sinkronisasi activeContent untuk pemicu animasi StrokeText saat menyeberang titik tengah
    if (prev < 0.5 && next >= 0.5) {
      setActiveContent(1)
    } else if (prev >= 0.5 && next < 0.5) {
      setActiveContent(0)
    }

    const atTop = prev <= 0 && delta < 0       // mentok atas (konten 0) & terus scroll ke atas
    const atBottom = prev >= 1 && delta > 0    // mentok bawah (konten 1) & terus scroll ke bawah
    if (atTop || atBottom) {
      if (now - boundaryHitTimeRef.current < OVERSHOOT_COOLDOWN_MS) return // serap inersia
      // Mentok ATAS: kabut kembali ke Section 3 digerakkan scroll (App.jsx), threshold-nya di FROST_VEIL_CONFIG
      if (atTop && onScrubBack) { onScrubBack(Math.abs(delta)); return }
      overshootRef.current += Math.abs(delta)
      if (overshootRef.current > SCROLL_OVERSHOOT_EXIT_PX) {
        overshootRef.current = 0
        // [FIX] Dulu isExitingRef langsung di-set true walau App MENOLAK pindah (transitionLock aktif),
        // sehingga applyDelta return selamanya => scroll di 3.5 mati total. Sekarang hanya terkunci bila diterima.
        const accepted = atTop ? (onBack ? onBack() : undefined) : (onNext ? onNext() : undefined)
        if (accepted !== false) isExitingRef.current = true
      }
      return
    }

    // Reset overshoot saat sedang di dalam rentang
    overshootRef.current = 0
  }, [onBack, onNext, onScrubBack])

  // Handler input wheel delta dari App.jsx
  const onWheelDelta = useCallback((deltaY) => applyDelta(deltaY * SCROLL_WHEEL_FACTOR), [applyDelta])

  // Handler touch delta untuk layar sentuh HP
  const onTouchDelta = useCallback((dy) => applyDelta(dy * SCROLL_TOUCH_FACTOR), [applyDelta])

  // Handler touch end
  const onTouchEnd = useCallback(() => {
    overshootRef.current = 0
  }, [])

  // Handler imperative next / back (jika dipanggil dari keyboard / tombol)
  const next = useCallback(() => {
    if (targetProgRef.current < 0.95) {
      targetProgRef.current = 1
      setActiveContent(1)
    } else {
      if (onNext) onNext()
    }
  }, [onNext])

  const back = useCallback(() => {
    if (targetProgRef.current > 0.05) {
      targetProgRef.current = 0
      setActiveContent(0)
    } else {
      if (onBack) onBack()
    }
  }, [onBack])

  // Style objek CSS variabel untuk penyesuaian dinamis side panels & kartu
  const sidePanelStyles = useMemo(() => ({
    '--side-panel-top': `${SIDE_PANEL_TOP_PERCENT}%`,
    '--side-panel-width': SIDE_PANEL_WIDTH,
    '--side-panel-left': SIDE_PANEL_LEFT_OFFSET,
    '--side-panel-right': SIDE_PANEL_RIGHT_OFFSET,
    '--side-panel-gap': SIDE_PANEL_GAP,
    '--side-panel-mobile-display': SIDE_PANELS_SHOW_ON_MOBILE ? 'flex' : 'none',
  }), [])

  const cardStyles = useMemo(() => ({
    '--card-bg': CARD_BG,
    '--card-border': CARD_BORDER_COLOR,
    '--card-radius': CARD_BORDER_RADIUS,
    '--card-padding': CARD_PADDING,
    '--card-blur': CARD_BLUR,
    '--card-shadow': CARD_BOX_SHADOW,
    '--float-amp': `${TEXT_FLOAT_AMPLITUDE}px`,
  }), [])

  // Mask gelombang (komplemen mask Section 3): Section 3.5 hanya terlihat DI DALAM elips gelombang.
  // Diatur imperatif dari App.jsx per frame (nol re-render).
  const setWaveMask = useCallback((mask) => {
    const el = sectionDomRef.current
    if (!el) return
    el.style.maskImage = mask
    el.style.webkitMaskImage = mask
  }, [])

  // Posisi tepi atas lembar 3.5 (vh dari atas layar; 0 = menutup penuh). Ditulis langsung ke DOM (nol re-render).
  const setSheetY = useCallback((yVh) => {
    sheetYRef.current = yVh
    const el = sectionDomRef.current
    if (el) el.style.transform = `translate3d(0, ${yVh}vh, 0)`
  }, [])

  // Expose imperative handle untuk App.jsx
  useImperativeHandle(ref, () => ({
    setSheetY,
    next,
    back,
    onWheelDelta,
    onTouchDelta,
    onTouchEnd,
    setWaveMask,
  }), [next, back, onWheelDelta, onTouchDelta, onTouchEnd, setWaveMask, setSheetY])

  const showSection = isVisible || behindSheet

  // Canvas 3D aktif: saat terlihat, saat sapuan balik (konten masih tampil), dan — di desktop — saat
  // gelombang masuk menyapu (preview) agar scene sudah "hangat" ketika Golem tiba.
  const previewRender = isPreview && !isReturning && (isMobile ? PREVIEW_RENDER_MOBILE : PREVIEW_RENDER_DESKTOP)
  // Pemanasan singkat sekali saat mount (konten masih tersembunyi => murah): mengompilasi pipeline
  // bloom/EffectComposer di awal, bukan saat Golem tampil.
  const [warm, setWarm] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setWarm(false), 900)
    return () => clearTimeout(t)
  }, [])
  const canvasActive = showSection || isReturning || veilActive || previewRender || warm

  const rootClass = [
    'section-why-us',
    (showSection || isPreview || veilActive) ? 'section-why-us--visible' : '',
    veilActive ? 'section-why-us--preview' : '',
    behindSheet ? 'section-why-us--behind' : '',
    isContentEntered ? 'section-why-us--entered' : '',
    isPreview ? 'section-why-us--preview' : '',
  ].filter(Boolean).join(' ')

  return (
    <section
      ref={sectionDomRef}
      className={rootClass}
      style={{
        '--scroll-p': '0',
        '--s35-behind-dur': `${sheetDurationMs}ms`,
        // isPreview: tampil DI ATAS terrain (z 3) tapi di bawah Section 3 (z 4), pointer-events nonaktif,
        // langsung terlihat penuh tanpa delay transisi. Bentuk tampilnya dipotong oleh mask gelombang
        // (lihat setWaveMask). Dulu z-index 2 -> berada DI BAWAH terrain, sehingga gunung & salju
        // tetap tampak menembus area galaxy yang tersibak, lalu hilang tiba-tiba saat gelombang selesai.
        ...(isPreview ? { zIndex: 3, pointerEvents: 'none', opacity: 1, transform: 'none', visibility: 'visible', transition: 'none' } : {}),
        // [FIX] Lembar 3.5 harus MENIMPA Section 3 (wrapper z-index 4 di App). Class `--preview` (sisa desain
        // gelombang) menaruhnya di z 3 => kartu Section 3 tetap tampil di atas lembar. Paksa di atas selama
        // kabut berjalan / 3.5 aktif (kecuali saat sheet 2D naik, urutan itu diatur CSS).
        ...(((veilActive || isVisible) && !is2D) ? { zIndex: 5 } : {}),
        // Lembar kabut: posisi dikendalikan scroll (lihat setSheetY), tanpa transisi CSS
        ...(sheetOwned ? {
          opacity: 1,
          transition: 'none',
          transform: `translate3d(0, ${sheetYRef.current}vh, 0)`,
          pointerEvents: veilActive ? 'none' : undefined,
          visibility: (veilActive || isVisible || (behindSheet && arrivedViaVeilRef.current)) ? 'visible' : 'hidden',
        } : {}),
      }}
    >
      {/* Galaxy Background + aurora yang bernapas pelan */}
      <div className="section-why-us__bg" />
      <div className="section-why-us__aurora" />

      {/* Sinar cahaya (god rays) dari atas */}
      <div className="section-why-us__rays" />

      {/* Bintang-bintang */}
      <div className="section-why-us__stars">
        {stars.map((star) => (
          <div
            key={star.id}
            className="section-why-us__star"
            style={{
              left: star.left,
              top: star.top,
              width: `${star.size}px`,
              height: `${star.size}px`,
              '--star-dur': star.dur,
              '--star-delay': star.delay,
              '--star-brightness': star.brightness,
            }}
          />
        ))}
      </div>

      {/* Glitch text mengambang */}
      <div className="section-why-us__glitch-layer">
        {glitchTexts.map((gt) => (
          <div
            key={gt.id}
            className="section-why-us__glitch-text"
            style={{
              left: gt.left,
              top: gt.top,
              '--glitch-dur': gt.dur,
              '--glitch-delay': gt.delay,
              '--glitch-opacity': gt.opacity,
              transform: `rotate(${gt.rotate})`,
            }}
          >
            {gt.text}
          </div>
        ))}
      </div>

      {/* Canvas 3D — Shared scene (tetap aktif di content 0 & 1, batu orbit & debu tetap ada) */}
      <div className="section-why-us__canvas">
        <Canvas
          frameloop={canvasActive ? 'always' : 'never'}
          camera={{ position: [0, CAMERA_HEIGHT, CAMERA_END_DISTANCE + CAMERA_DOLLY_DISTANCE], fov: CAMERA_FOV }}
          dpr={isMobile ? [1, 1.25] : [1, 1.5]}
          gl={{
            antialias: false,
            alpha: true,
            clearAlpha: 0,
            powerPreference: 'high-performance',
          }}
          events={false}
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <WhyUsScene
            hologramProgress={hologramProgress}
            scrollProgRef={scrollProgRef}
            targetProgRef={targetProgRef}
            entryRef={entryProgRef}
            sectionDomRef={sectionDomRef}
            isMobile={isMobile}
            isContentEntered={isContentEntered}
          />
        </Canvas>
      </div>

      {/* Lapisan sinematik di atas canvas: lens streak, vignette, film grain */}
      <div className="section-why-us__flare" />
      <div className="section-why-us__vignette" />
      <div className="section-why-us__grain" />

      {/* Konten teks overlay — content 0 (tengah atas, Scroll-Driven) */}
      <div className={`section-why-us__content ${!isContentEntered ? 'section-why-us__content--hidden' : isContentEntering ? 'section-why-us__content--entering' : ''} ${activeContent !== 0 ? 'section-why-us__content--inactive' : ''}`}>
        <div className="section-why-us__headline-techtext">
          <TechText
            text={WHYUS_HEADLINE_TEXT}
            fontSize={WHYUS_HEADLINE_FONT_SIZE}
            fontWeight={WHYUS_HEADLINE_FONT_WEIGHT}
            letterSpacing={WHYUS_HEADLINE_LETTER_SPACING}
            color={WHYUS_HEADLINE_COLOR}
            accentColor={WHYUS_HEADLINE_ACCENT}
            reach={WHYUS_HEADLINE_REACH}
            specks={WHYUS_HEADLINE_SPECKS}
            reveal={WHYUS_HEADLINE_REVEAL}
            draggable={true}
            sweep={true}
          />
        </div>
        {CONTENT_0_SHOW_SUBTITLE && (
          <>
            <span className="section-why-us__divider" />
            <p className="section-why-us__subtitle">{CONTENT_0_SUBTITLE}</p>
          </>
        )}

        {/* Panel Teks Kiri & Kanan (Content 0: Golem) */}
        {SIDE_PANELS_ENABLED && (
          <>
            <div
              className="section-why-us__side-panel section-why-us__side-panel--left"
              style={sidePanelStyles}
            >
              {CONTENT_0_LEFT_PANELS.map((item, idx) => (
                <div
                  key={idx}
                  className="section-why-us__side-card"
                  style={{
                    ...cardStyles,
                    animation: TEXT_FLOAT_ENABLED
                      ? `s35TextFloat ${TEXT_FLOAT_DURATION}s ease-in-out ${idx * TEXT_FLOAT_STAGGER}s infinite`
                      : 'none',
                  }}
                >
                  {item.tag && (
                    <span className="section-why-us__card-tag" style={{ fontSize: TAG_FONT_SIZE, color: TAG_COLOR }}>

                    </span>
                  )}
                  <div className="section-why-us__card-title">
                    <StrokeText
                      key={`c0-l-${idx}-${isContentEntered ? 'entered' : 'hidden'}-${activeContent === 0 ? 'active' : 'idle'}`}
                      text={item.title}
                      strokeColor={C0_STROKE_COLOR}
                      fillColor={C0_FILL_COLOR}
                      strokeWidth={C0_STROKE_WIDTH}
                      drawDuration={C0_DRAW_DURATION}
                      fillDelay={C0_FILL_DELAY}
                      stagger={C0_STAGGER}
                      ease={C0_EASE}
                      fontSize={C0_FONT_SIZE}
                      fontWeight={C0_FONT_WEIGHT}
                      letterSpacing={C0_LETTER_SPACING}
                      fillMode={C0_FILL_MODE}
                      trigger="mount"
                      preserveAspectRatio="xMinYMid meet"
                      replayOnHover={SIDE_PANEL_REPLAY_ON_HOVER}
                    />
                  </div>

                  <p className="section-why-us__card-desc" style={{ fontSize: DESC_FONT_SIZE, color: DESC_COLOR, lineHeight: DESC_LINE_HEIGHT }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            <div
              className="section-why-us__side-panel section-why-us__side-panel--right"
              style={sidePanelStyles}
            >
              {CONTENT_0_RIGHT_PANELS.map((item, idx) => (
                <div
                  key={idx}
                  className="section-why-us__side-card"
                  style={{
                    ...cardStyles,
                    animation: TEXT_FLOAT_ENABLED
                      ? `s35TextFloat ${TEXT_FLOAT_DURATION}s ease-in-out ${(idx + 0.5) * TEXT_FLOAT_STAGGER}s infinite`
                      : 'none',
                  }}
                >
                  {item.tag && (
                    <span className="section-why-us__card-tag" style={{ fontSize: TAG_FONT_SIZE, color: TAG_COLOR }}>

                    </span>
                  )}
                  <div className="section-why-us__card-title">
                    <StrokeText
                      key={`c0-r-${idx}-${isContentEntered ? 'entered' : 'hidden'}-${activeContent === 0 ? 'active' : 'idle'}`}
                      text={item.title}
                      strokeColor={C0_STROKE_COLOR}
                      fillColor={C0_FILL_COLOR}
                      strokeWidth={C0_STROKE_WIDTH}
                      drawDuration={C0_DRAW_DURATION}
                      fillDelay={C0_FILL_DELAY}
                      stagger={C0_STAGGER}
                      ease={C0_EASE}
                      fontSize={C0_FONT_SIZE}
                      fontWeight={C0_FONT_WEIGHT}
                      letterSpacing={C0_LETTER_SPACING}
                      fillMode={C0_FILL_MODE}
                      trigger="mount"
                      preserveAspectRatio="xMinYMid meet"
                      replayOnHover={SIDE_PANEL_REPLAY_ON_HOVER}
                    />
                  </div>

                  <p className="section-why-us__card-desc" style={{ fontSize: DESC_FONT_SIZE, color: DESC_COLOR, lineHeight: DESC_LINE_HEIGHT }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Content 1: GolemHand — TechText headline di tengah atas (Scroll-Driven) */}
      <div className={`section-why-us__golemhand ${!isContentEntered ? 'section-why-us__content--hidden' : isContentEntering ? 'section-why-us__golemhand--entering' : ''} ${activeContent !== 1 ? 'section-why-us__golemhand--inactive' : ''}`}>
        <div className="section-why-us__golemhand-techtext">
          <TechText
            text={GOLEMHAND_TEXT}
            fontSize={GOLEMHAND_FONT_SIZE}
            fontWeight={GOLEMHAND_FONT_WEIGHT}
            letterSpacing={GOLEMHAND_LETTER_SPACING}
            color={GOLEMHAND_COLOR}
            accentColor={GOLEMHAND_ACCENT}
            reach={GOLEMHAND_REACH}
            specks={GOLEMHAND_SPECKS}
            reveal={GOLEMHAND_REVEAL}
            draggable={true}
            sweep={true}
          />
        </div>

        {/* Panel Teks Kiri & Kanan (Content 1: GolemHand) */}
        {SIDE_PANELS_ENABLED && (
          <>
            <div
              className="section-why-us__side-panel section-why-us__side-panel--left"
              style={sidePanelStyles}
            >
              {CONTENT_1_LEFT_PANELS.map((item, idx) => (
                <div
                  key={idx}
                  className="section-why-us__side-card"
                  style={{
                    ...cardStyles,
                    animation: TEXT_FLOAT_ENABLED
                      ? `s35TextFloat ${TEXT_FLOAT_DURATION}s ease-in-out ${idx * TEXT_FLOAT_STAGGER}s infinite`
                      : 'none',
                  }}
                >
                  {item.tag && (
                    <span className="section-why-us__card-tag" style={{ fontSize: TAG_FONT_SIZE, color: C1_STROKE_COLOR }}>

                    </span>
                  )}
                  <div className="section-why-us__card-title">
                    <StrokeText
                      key={`c1-l-${idx}-${activeContent === 1 ? 'active' : 'idle'}`}
                      text={item.title}
                      strokeColor={C1_STROKE_COLOR}
                      fillColor={C1_FILL_COLOR}
                      strokeWidth={C1_STROKE_WIDTH}
                      drawDuration={C1_DRAW_DURATION}
                      fillDelay={C1_FILL_DELAY}
                      stagger={C1_STAGGER}
                      ease={C1_EASE}
                      fontSize={C1_FONT_SIZE}
                      fontWeight={C1_FONT_WEIGHT}
                      letterSpacing={C1_LETTER_SPACING}
                      fillMode={C1_FILL_MODE}
                      trigger="mount"
                      preserveAspectRatio="xMinYMid meet"
                      replayOnHover={SIDE_PANEL_REPLAY_ON_HOVER}
                    />
                  </div>

                  <p className="section-why-us__card-desc" style={{ fontSize: DESC_FONT_SIZE, color: DESC_COLOR, lineHeight: DESC_LINE_HEIGHT }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            <div
              className="section-why-us__side-panel section-why-us__side-panel--right"
              style={sidePanelStyles}
            >
              {CONTENT_1_RIGHT_PANELS.map((item, idx) => (
                <div
                  key={idx}
                  className="section-why-us__side-card"
                  style={{
                    ...cardStyles,
                    animation: TEXT_FLOAT_ENABLED
                      ? `s35TextFloat ${TEXT_FLOAT_DURATION}s ease-in-out ${(idx + 0.5) * TEXT_FLOAT_STAGGER}s infinite`
                      : 'none',
                  }}
                >
                  {item.tag && (
                    <span className="section-why-us__card-tag" style={{ fontSize: TAG_FONT_SIZE, color: C1_STROKE_COLOR }}>

                    </span>
                  )}
                  <div className="section-why-us__card-title">
                    <StrokeText
                      key={`c1-r-${idx}-${activeContent === 1 ? 'active' : 'idle'}`}
                      text={item.title}
                      strokeColor={C1_STROKE_COLOR}
                      fillColor={C1_FILL_COLOR}
                      strokeWidth={C1_STROKE_WIDTH}
                      drawDuration={C1_DRAW_DURATION}
                      fillDelay={C1_FILL_DELAY}
                      stagger={C1_STAGGER}
                      ease={C1_EASE}
                      fontSize={C1_FONT_SIZE}
                      fontWeight={C1_FONT_WEIGHT}
                      letterSpacing={C1_LETTER_SPACING}
                      fillMode={C1_FILL_MODE}
                      trigger="mount"
                      preserveAspectRatio="xMinYMid meet"
                      replayOnHover={SIDE_PANEL_REPLAY_ON_HOVER}
                    />
                  </div>

                  <p className="section-why-us__card-desc" style={{ fontSize: DESC_FONT_SIZE, color: DESC_COLOR, lineHeight: DESC_LINE_HEIGHT }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Track Indikator Scroll 200vh di Samping Kanan */}
      {SHOW_SCROLL_INDICATOR && (
        <div className={`section-why-us__scroll-track ${!isContentEntered ? 'section-why-us__content--hidden' : ''}`}>
          <div className="section-why-us__scroll-thumb" />
        </div>
      )}

      {/* Peredup saat sheet 2D naik menutupi Section 3.5 (lebih murah daripada filter: brightness) */}
      <div className="section-why-us__dim" />
    </section>
  )
})

useGLTF.preload('/models/golem.glb')
useGLTF.preload('/golemhand.glb')

export default SectionWhyUs