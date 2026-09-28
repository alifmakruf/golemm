// State pointer bersama antar canvas (di luar React, tidak memicu re-render).
// overModel: true selama kursor sedang tepat di atas model Golem (diisi oleh
// GolemModel.jsx tiap frame). Dipakai TerrainWaves.jsx supaya klik pada Golem
// tidak ikut memicu gelombang terrain, sementara klik di area kosong di sekitar
// Golem tetap memicu gelombang.
export const golemPointerState = { overModel: false }
