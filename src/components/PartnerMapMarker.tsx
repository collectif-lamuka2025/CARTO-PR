import React from 'react';
import { PartnerLocation } from '../types';

interface PartnerMapMarkerProps {
  location: PartnerLocation;
  isSelected?: boolean;
  onClick?: () => void;
}

export const PartnerMapMarker: React.FC<PartnerMapMarkerProps> = ({
  location,
  isSelected = false,
  onClick,
}) => {
  const color = location.categoryColor || '#3B82F6';

  return (
    <div
      onClick={onClick}
      className="relative cursor-pointer group transition-transform duration-200 hover:scale-125 select-none"
      style={{ transform: isSelected ? 'scale(1.3)' : 'scale(1)' }}
      title={`${location.name} (${location.categoryName || 'Partenaire'})`}
    >
      {/* Outer pulsing glow halo for high visibility against map */}
      <span
        className="absolute -inset-2 rounded-full animate-ping opacity-60 pointer-events-none"
        style={{ backgroundColor: color }}
      />

      {/* Radiant glow background */}
      <div
        className="absolute -inset-1 rounded-full blur-xs opacity-80"
        style={{ backgroundColor: color }}
      />

      {/* Main Marker Pin */}
      <div
        className="relative flex items-center justify-center w-9 h-9 rounded-full border-2 border-white shadow-xl text-white font-bold text-xs"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 14px ${color}, 0 4px 6px rgba(0,0,0,0.4)`,
        }}
      >
        <span className="drop-shadow-md">
          {location.name ? location.name.slice(0, 2).toUpperCase() : '📍'}
        </span>
      </div>

      {/* Needle drop pointer */}
      <div
        className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] mx-auto -mt-0.5 filter drop-shadow"
        style={{ borderTopColor: color }}
      />

      {/* Label Tooltip */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none z-50 whitespace-nowrap">
        <div className="bg-slate-900/95 text-white text-[11px] font-semibold px-2 py-1 rounded shadow-lg border border-slate-700">
          <p className="font-bold">{location.name}</p>
          {location.categoryName && (
            <p className="text-[10px] opacity-80 font-normal" style={{ color }}>
              ● {location.categoryName}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
