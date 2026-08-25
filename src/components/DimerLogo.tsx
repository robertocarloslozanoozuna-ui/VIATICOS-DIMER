import React from 'react';

interface DimerLogoProps {
  className?: string;
  variant?: 'dark' | 'light' | 'color';
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function DimerLogo({
  className = '',
  variant = 'color',
  showText = true,
  size = 'md',
}: DimerLogoProps) {
  // Height sizing
  const heights = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
  };

  const isDark = variant === 'dark'; // for dark background (white text)

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Official DIMER Vector Mark */}
      <svg
        viewBox="0 0 290 68"
        className={`${heights[size]} w-auto shrink-0`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="DIMER Logo"
      >
        {/* Circle Target Icon with Vertical Bars */}
        <g id="dimer-icon">
          {/* Outer Blue Circle */}
          <circle cx="28" cy="40" r="18" stroke="#005A9C" strokeWidth="6.5" fill="none" />
          {/* Inner Red Core Dot */}
          <circle cx="28" cy="40" r="7.5" fill="#D92525" />
          {/* Three Vertical Bars rising on the right side of the circle ('d' pattern) */}
          <rect x="42" y="16" width="5.5" height="34" rx="2.75" fill="#005A9C" />
          <rect x="52" y="10" width="5.5" height="40" rx="2.75" fill="#005A9C" />
          <rect x="62" y="24" width="5.5" height="26" rx="2.75" fill="#005A9C" />
        </g>

        {/* Wordmark DIMER */}
        {showText && (
          <g id="dimer-text" fill={isDark ? '#FFFFFF' : '#005A9C'}>
            {/* D */}
            <path
              d="M78 12 H102 C114 12 122 19 122 34 C122 49 114 56 102 56 H78 V12 Z M89.5 21 V47 H100.5 C108 47 111.5 42 111.5 34 C111.5 26 108 21 100.5 21 H89.5 Z"
            />
            {/* I */}
            <path d="M128 12 H139 V56 H128 Z" />
            {/* M */}
            <path
              d="M146 12 H158.5 L168.5 39.5 L178.5 12 H191 V56 H180.5 V27.5 L172.5 48 H164.5 L156.5 27.5 V56 H146 Z"
            />
            {/* E */}
            <path
              d="M198 12 H226 V20.5 H209 V29 H224 V37.5 H209 V47.5 H227 V56 H198 Z"
            />
            {/* R */}
            <path
              d="M234 12 H258 C267.5 12 273 17 273 26 C273 32.5 268.5 36.5 262 38 L275 56 H261.5 L249.5 39 H245.5 V56 H234 V12 Z M245.5 20.5 V30.5 H256.5 C260 30.5 262 28.5 262 25.5 C262 22.5 260 20.5 256.5 20.5 H245.5 Z"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
