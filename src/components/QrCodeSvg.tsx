import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';

interface QrCodeSvgProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
}

export default function QrCodeSvg({
  value,
  size = 180,
  color = '#0f172a',
  backgroundColor = '#ffffff',
}: QrCodeSvgProps) {
  const { pathData, viewBoxSize } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();

    const count = qr.getModuleCount();
    const quietZone = 2;
    const totalModules = count + quietZone * 2;
    const parts: string[] = [];

    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          const x = col + quietZone;
          const y = row + quietZone;
          parts.push(`M${x},${y}h1v1h-1z`);
        }
      }
    }

    return {
      pathData: parts.join(''),
      viewBoxSize: totalModules,
    };
  }, [value]);

  return (
    <View style={[styles.wrapper, { width: size + 16, height: size + 16, backgroundColor }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}>
        <Rect width={viewBoxSize} height={viewBoxSize} fill={backgroundColor} />
        <Path d={pathData} fill={color} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});
