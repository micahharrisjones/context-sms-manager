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
  
  // Generate hue values (0-360) for soft, pastel colors
  const hue1 = hash % 360;
  const hue2 = (hash * 137) % 360; // Golden angle for good color separation
  
  // Use low saturation and high lightness for soft, subtle colors
  const primary = `hsl(${hue1}, 35%, 85%)`;
  const secondary = `hsl(${hue2}, 30%, 80%)`;
  
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

export function BoardIcon({ boardName, size = 60 }: BoardIconProps) {
  const colors = generateColors(boardName);
  const shape = generateShape(boardName);
  const hash = hashString(boardName);
  
  // Use hash to determine rotation and position variations
  const rotation = (hash % 60) - 30; // -30 to 30 degrees (less rotation)
  const scale = 0.5 + ((hash % 20) / 100); // 0.5 to 0.7 scale (smaller shapes)

  const renderShape = () => {
    const centerX = size / 2;
    const centerY = size / 2;
    const shapeSize = (size * 0.35) * scale;

    switch (shape) {
      case 'circle':
        return (
          <circle
            cx={centerX}
            cy={centerY}
            r={shapeSize}
            fill={colors.primary}
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
            fill={colors.primary}
            transform={`rotate(${rotation} ${centerX} ${centerY})`}
            rx={shapeSize * 0.25}
          />
        );
      
      case 'triangle':
        const h = shapeSize * 1.5;
        const w = shapeSize * 1.3;
        return (
          <polygon
            points={`${centerX},${centerY - h} ${centerX - w},${centerY + h/2} ${centerX + w},${centerY + h/2}`}
            fill={colors.primary}
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
            fill={colors.primary}
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
            fill={colors.primary}
            transform={`rotate(${rotation} ${centerX} ${centerY})`}
          />
        );
    }
  };

  return (
    <div className="flex items-center justify-center flex-shrink-0">
      <svg 
        width={size} 
        height={size} 
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background circle with solid color */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size / 2) - 2}
          fill={colors.secondary}
        />
        
        {/* Inner shape */}
        {renderShape()}
      </svg>
    </div>
  );
}
