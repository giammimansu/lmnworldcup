/* global React */
// ============================================================================
// LMN WORLD CUP — Custom football icon set
// 24x24 · stroke-based · stroke-width 1.5 · round caps/joins · currentColor
// Usage: <Icon name="ball" size={24} /> · <Icon name="trophy" filled />
// ============================================================================
(function () {
  const S = React.createElement;

  // Each entry returns the inner SVG children for the stroked variant.
  const stroke = {
    ball: (
      <g key="ball">
        <circle cx="12" cy="12" r="9" />
        <polygon points="12,8 15.8,10.8 14.3,15.2 9.7,15.2 8.2,10.8" />
        <path d="M12 8V3.2M15.8 10.8L20.5 9.3M8.2 10.8L3.5 9.3M14.3 15.2L17.1 19.2M9.7 15.2L6.9 19.2" />
      </g>
    ),
    goal: (
      <g key="goal">
        <path d="M4 8H20V19" />
        <path d="M4 8V19H20" />
        <path d="M9 8V19M15 8V19M4 12.5H20M4 15.7H20" opacity="0.65" />
      </g>
    ),
    whistle: (
      <g key="whistle">
        <circle cx="9" cy="14" r="5" />
        <path d="M13.3 11.2L21 9V13.4L13.7 16.6" />
        <path d="M9 9V7.2" />
        <circle cx="9" cy="5.8" r="1.1" />
      </g>
    ),
    trophy: (
      <g key="trophy">
        <path d="M7 4H17V8A5 5 0 0 1 7 8Z" />
        <path d="M7 5H4V7A3 3 0 0 0 7 10" />
        <path d="M17 5H20V7A3 3 0 0 1 17 10" />
        <path d="M12 13V16" />
        <path d="M9 20H15L13.7 16H10.3Z" />
      </g>
    ),
    bracket: (
      <g key="bracket">
        <path d="M3 5H7V8H11" />
        <path d="M3 11H7V8" />
        <path d="M3 13H7V16H11" />
        <path d="M3 19H7V16" />
        <path d="M11 8V16M11 12H15" />
        <path d="M15 9H21V15H15Z" />
      </g>
    ),
    calendar: (
      <g key="calendar">
        <rect x="4" y="5" width="16" height="15" rx="2.5" />
        <path d="M4 9.5H20" />
        <path d="M8 3V6M16 3V6" />
        <path d="M11 13.5H13" />
      </g>
    ),
    clock: (
      <g key="clock">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7V12L15.5 14" />
      </g>
    ),
    fire: (
      <g key="fire">
        <path d="M12 2.5C13.5 6.5 17 8 17 13A5 5 0 1 1 7 13C7 10.6 8.4 9.2 9.4 10.2C10.4 6.8 9 5.2 12 2.5Z" />
        <path d="M12 21A2.4 2.4 0 0 1 9.6 18.6C9.6 16.8 12 16.2 12 13.6C13.8 15.4 14.4 16.8 14.4 18.6A2.4 2.4 0 0 1 12 21Z" opacity="0.55" />
      </g>
    ),
    lightning: (
      <g key="lightning">
        <path d="M13 2.5L4 14H11L10 21.5L20 9H12L13 2.5Z" />
      </g>
    ),
    shield: (
      <g key="shield">
        <path d="M12 3L20 6V11C20 16 16.5 19.6 12 21C7.5 19.6 4 16 4 11V6Z" />
        <path d="M9 12L11 14L15.5 9.8" opacity="0.7" />
      </g>
    ),
    star: (
      <g key="star">
        <path d="M12 3L14.6 9.2L21 9.7L16 14L17.6 20.5L12 16.8L6.4 20.5L8 14L3 9.7L9.4 9.2Z" />
      </g>
    ),
    'prediction-arrow': (
      <g key="prediction-arrow">
        <path d="M3 17.5L9 11.5L13 15.5L20.5 8" />
        <path d="M15 8H20.5V13.5" />
      </g>
    ),
  };

  // Filled overrides (only for ball, trophy, star).
  const filled = {
    ball: (
      <g key="ball-f">
        <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" />
        <g stroke="var(--lmn-midnight-700, #090E1B)" strokeWidth="1.3" fill="none" strokeLinejoin="round" strokeLinecap="round">
          <polygon points="12,8 15.8,10.8 14.3,15.2 9.7,15.2 8.2,10.8" fill="var(--lmn-midnight-700, #090E1B)" />
          <path d="M12 8V4M15.8 10.8L19.5 9.6M8.2 10.8L4.5 9.6M14.3 15.2L16.6 18.4M9.7 15.2L7.4 18.4" />
        </g>
      </g>
    ),
    trophy: (
      <g key="trophy-f" fill="currentColor" stroke="none">
        <path d="M7 4H17V8A5 5 0 0 1 7 8Z" />
        <path d="M7 4.5H3.5V7.2A3.5 3.5 0 0 0 7.4 10.6L6.6 9.2A2.2 2.2 0 0 1 5 7V6H7Z" />
        <path d="M17 4.5H20.5V7.2A3.5 3.5 0 0 1 16.6 10.6L17.4 9.2A2.2 2.2 0 0 0 19 7V6H17Z" />
        <rect x="11.1" y="12.5" width="1.8" height="4" />
        <path d="M8.6 20.5L10.2 15.8H13.8L15.4 20.5Z" />
      </g>
    ),
    star: (
      <g key="star-f" fill="currentColor" stroke="none">
        <path d="M12 3L14.6 9.2L21 9.7L16 14L17.6 20.5L12 16.8L6.4 20.5L8 14L3 9.7L9.4 9.2Z" />
      </g>
    ),
  };

  const ICON_NAMES = Object.keys(stroke);

  function Icon({ name, size = 24, filled: isFilled = false, strokeWidth = 1.5, style, className, ...rest }) {
    const useFill = isFilled && filled[name];
    const inner = useFill ? filled[name] : (stroke[name] || stroke.ball);
    return S(
      'svg',
      {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: useFill ? 'none' : 'currentColor',
        strokeWidth,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className,
        style,
        'aria-hidden': true,
        ...rest,
      },
      inner
    );
  }

  window.Icon = Icon;
  window.ICON_NAMES = ICON_NAMES;
  window.FILLED_ICONS = Object.keys(filled);
})();
