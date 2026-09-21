import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * Professional Medical Barcode Renderer (Code 128)
 * Generates high-density, vector-crisp, scannable 1D barcodes.
 */
export default function BarcodeRenderer({
  value,
  width = 1.4,
  height = 36,
  fontSize = 11,
  displayValue = true,
  lineColor = '#0f172a',
  background = 'transparent',
  margin = 2,
  className = '',
  style = {}
}) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, String(value).trim(), {
          format: 'CODE128',
          width,
          height,
          displayValue,
          font: 'monospace',
          fontSize,
          fontOptions: 'bold',
          textMargin: 3,
          textAlign: 'center',
          textPosition: 'bottom',
          background,
          lineColor,
          margin
        });
      } catch (err) {
        console.error('Error generating Code128 barcode:', err);
      }
    }
  }, [value, width, height, fontSize, displayValue, lineColor, background, margin]);

  if (!value) return null;

  return (
    <svg 
      ref={svgRef} 
      className={className}
      style={{ 
        display: 'block', 
        maxWidth: '100%', 
        height: 'auto',
        ...style 
      }} 
    />
  );
}
