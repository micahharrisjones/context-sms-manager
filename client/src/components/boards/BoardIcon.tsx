interface BoardIconProps {
  boardName: string;
  size?: number;
}

// Simple hash function to generate deterministic values from board name
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Generate a random-looking but deterministic color from board name
function generateColors(boardName: string): { primary: string; secondary: string } {
  const hash = hashString(boardName);
  
  // Generate hue values (0-360) for vibrant colors
  const hue1 = hash % 360;
  const hue2 = (hash * 137) % 360; // Golden angle for good color separation
  
  // Use high saturation and medium-high lightness for vibrant, friendly colors
  const primary = `hsl(${hue1}, 75%, 55%)`;
  const secondary = `hsl(${hue2}, 70%, 60%)`;
  
  return { primary, secondary };
}

// Generate a shape type from board name
function generateShape(boardName: string): 'circle' | 'square' | 'triangle' | 'hexagon' | 'star' {
  const hash = hashString(boardName);
  const shapes: Array<'circle' | 'square' | 'triangle' | 'hexagon' | 'star'> = [
    'circle', 'square', 'triangle', 'hexagon', 'star'
  ];
  return shapes[hash % shapes.length];
}

export function BoardIcon({ boardName, size = 80 }: BoardIconProps) {
  const colors = generateColors(boardName);
  const shape = generateShape(boardName);
  const hash = hashString(boardName);
  
  // Use hash to determine rotation and position variations
  const rotation = (hash % 180) - 90; // -90 to 90 degrees
  const scale = 0.6 + ((hash % 40) / 100); // 0.6 to 1.0 scale

  const renderShape = () => {
    const centerX = size / 2;
    const centerY = size / 2;
    const shapeSize = (size * 0.4) * scale;

    switch (shape) {
      case 'circle':
        return (
          <circle
            cx={centerX}
            cy={centerY}
            r={shapeSize}
            fill={colors.secondary}
            transform={`rotate(${rotation} ${centerX} ${centerY})`}
          />
        );
      
      case 'square':
        return (
          <rect
            x={centerX - shapeSize}
            y={centerY - shapeSize}
            width={shapeSize * 2}
            height={shapeSize * 2}
            fill={colors.secondary}
            transform={`rotate(${rotation} ${centerX} ${centerY})`}
            rx={shapeSize * 0.2}
          />
        );
      
      case 'triangle':
        const h = shapeSize * 1.5;
        const w = shapeSize * 1.3;
        return (
          <polygon
            points={`${centerX},${centerY - h} ${centerX - w},${centerY + h/2} ${centerX + w},${centerY + h/2}`}
            fill={colors.secondary}
            transform={`rotate(${rotation} ${centerX} ${centerY})`}
          />
        );
      
      case 'hexagon':
        const hexSize = shapeSize * 1.2;
        const points = Array.from({ length: 6 }, (_, i) => {
          const angle = (Math.PI / 3) * i;
          const x = centerX + hexSize * Math.cos(angle);
          const y = centerY + hexSize * Math.sin(angle);
          return `${x},${y}`;
        }).join(' ');
        return (
          <polygon
            points={points}
            fill={colors.secondary}
            transform={`rotate(${rotation} ${centerX} ${centerY})`}
          />
        );
      
      case 'star':
        const starSize = shapeSize * 1.2;
        const starPoints = Array.from({ length: 10 }, (_, i) => {
          const angle = (Math.PI / 5) * i - Math.PI / 2;
          const r = i % 2 === 0 ? starSize : starSize * 0.5;
          const x = centerX + r * Math.cos(angle);
          const y = centerY + r * Math.sin(angle);
          return `${x},${y}`;
        }).join(' ');
        return (
          <polygon
            points={starPoints}
            fill={colors.secondary}
            transform={`rotate(${rotation} ${centerX} ${centerY})`}
          />
        );
    }
  };

  return (
    <div className="flex items-center justify-center">
      <svg 
        width={size} 
        height={size} 
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-sm"
      >
        {/* Background circle with gradient */}
        <defs>
          <linearGradient id={`gradient-${hashString(boardName)}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: colors.primary, stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: colors.secondary, stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        
        {/* Outer circle with gradient */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size / 2) - 2}
          fill={`url(#gradient-${hashString(boardName)})`}
        />
        
        {/* Inner shape */}
        {renderShape()}
      </svg>
    </div>
  );
}
