// Purely decorative. A little tribute to hampsterdance.com — fits the Win9x vibe.
export default function DancingHamster() {
  return (
    <div className="hamster-zone" aria-hidden="true">
      <div className="hamster-notes">
        <span>♪</span><span>♫</span><span>♪</span>
      </div>
      <div className="hamster">
        <svg viewBox="0 0 64 64" width="80" height="80" shapeRendering="crispEdges">
          {/* feet */}
          <g className="hamster-feet">
            <rect x="20" y="52" width="10" height="6" fill="#f2b48a" />
            <rect x="34" y="52" width="10" height="6" fill="#f2b48a" />
          </g>
          {/* body */}
          <rect x="14" y="22" width="36" height="32" rx="14" fill="#f4d29a" />
          <rect x="20" y="30" width="24" height="22" rx="10" fill="#fff3dc" />
          {/* ears */}
          <circle cx="20" cy="20" r="7" fill="#e9b779" />
          <circle cx="44" cy="20" r="7" fill="#e9b779" />
          <circle cx="20" cy="20" r="3" fill="#f7c9c0" />
          <circle cx="44" cy="20" r="3" fill="#f7c9c0" />
          {/* ribbon */}
          <path d="M28 14 L32 18 L36 14 L36 20 L28 20 Z" fill="#e0463c" />
          <circle cx="32" cy="17" r="2" fill="#ffd34d" />
          {/* face */}
          <circle cx="26" cy="34" r="2.6" fill="#2b2b2b" />
          <circle cx="38" cy="34" r="2.6" fill="#2b2b2b" />
          <circle cx="27" cy="33" r="0.9" fill="#fff" />
          <circle cx="39" cy="33" r="0.9" fill="#fff" />
          <ellipse cx="32" cy="39" rx="2.4" ry="1.8" fill="#f19a9a" />
          <circle cx="21" cy="39" r="2.4" fill="#f7c0c0" />
          <circle cx="43" cy="39" r="2.4" fill="#f7c0c0" />
          {/* paws */}
          <rect className="hamster-arm hamster-arm-l" x="10" y="34" width="8" height="8" rx="4" fill="#f4d29a" />
          <rect className="hamster-arm hamster-arm-r" x="46" y="34" width="8" height="8" rx="4" fill="#f4d29a" />
        </svg>
      </div>
    </div>
  )
}
