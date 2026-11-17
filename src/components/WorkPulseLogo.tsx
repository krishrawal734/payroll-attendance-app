import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';

interface WorkPulseLogoProps {
  size?: number;
}

export default function WorkPulseLogo({ size = 48 }: WorkPulseLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        <LinearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#818cf8" />
          <Stop offset="50%" stopColor="#4f46e5" />
          <Stop offset="100%" stopColor="#06b6d4" />
        </LinearGradient>
      </Defs>
      {/* Shield outline */}
      <Path
        d="M50 12 L78 24 C78 52 50 78 50 78 C50 78 22 52 22 24 Z"
        stroke="url(#logoGrad)"
        strokeWidth={5}
        strokeLinejoin="round"
        fill="rgba(79,70,229,0.18)"
      />
      {/* Heartbeat / Pulse line */}
      <Path
        d="M16 50 H33 L42 32 L51 64 L59 44 L67 50 H84"
        stroke="url(#logoGrad)"
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
