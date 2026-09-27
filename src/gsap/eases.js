// ============================================================================
// Padanan PERSIS kurva easing CSS (keyword & cubic-bezier custom) yang dipakai
// di seluruh project ini, supaya saat animasi dipindah dari CSS @keyframes ke
// GSAP, kecepatan & "rasa" gerakannya di viewport TIDAK berubah sedikit pun.
//
// Import EASE dari file ini di komponen manapun yang butuh animasi GSAP.
// ============================================================================
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

export const EASE = {
  // -- CSS timing-function keyword bawaan browser --
  linear: 'none',
  css: CustomEase.create('cssEase', '0.25, 0.1, 0.25, 1'),          // CSS "ease"
  easeIn: CustomEase.create('cssEaseIn', '0.42, 0, 1, 1'),          // CSS "ease-in"
  easeOut: CustomEase.create('cssEaseOut', '0, 0, 0.58, 1'),        // CSS "ease-out"
  easeInOut: CustomEase.create('cssEaseInOut', '0.42, 0, 0.58, 1'), // CSS "ease-in-out"

  // -- cubic-bezier custom yang dipakai berulang di CSS asli project --
  softOut: CustomEase.create('softOut', '0.23, 1, 0.32, 1'),   // cubic-bezier(0.23,1,0.32,1) — entrance utama (Hero, Loading)
  softOut2: CustomEase.create('softOut2', '0.16, 1, 0.3, 1'),  // cubic-bezier(0.16,1,0.3,1) — entrance card Section 2/3/4
  sharpIn: CustomEase.create('sharpIn', '0.5, 0, 0.75, 0'),    // cubic-bezier(0.5,0,0.75,0) — exit card (percepatan tajam)
}

export default EASE
