export default function TitleBar({ title }) {
  return (
    <div className="titlebar">
      <span className="tb-icon">📼</span>
      <span className="tb-title">{title}</span>
      <span className="tb-buttons">
        <span className="tb-btn outset">_</span>
        <span className="tb-btn outset">□</span>
        <span className="tb-btn outset">×</span>
      </span>
    </div>
  )
}
