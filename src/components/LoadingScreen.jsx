import './style/LoadingScreen.css'

// Progress 0-100 dari useProgress (asset loading asli Three.js)
export default function LoadingScreen({ progress = 0 }) {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">
          <span className="loading-text">Golem.Inc</span>
        </div>

        <div className="loading-spinner">
          <div className="spinner-ring" />
          <div className="spinner-ring" />
          <div className="spinner-ring" />
        </div>

        <p className="loading-status">Just Wait &amp; See</p>

        <div className="loading-progress">
          <div className="progress-bar" style={{ width: `${progress}%`, animation: 'none' }} />
        </div>
      </div>

      <div className="loading-backdrop" />
    </div>
  )
}
