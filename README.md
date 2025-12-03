# Circle Network - Urban Planning Visualization

An interactive multi-cell network visualization tool for exploring urban planning concepts and sustainability analysis. Create, customize, and export beautiful network diagrams showing how different city functions interconnect around living/community hubs.

![Circle Network Preview](../multicell_network_styled.png)

## Quick Start

### Option 1: Docker (Recommended - One Command!)

```bash
docker-compose up --build
```

Open http://localhost:3000 in your browser. Done!

### Option 2: Local Development

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

### Option 3: Development with Hot Reload (Docker)

```bash
docker-compose --profile dev up dev
```

## Features

### Interactive Canvas
- **Drag & Drop**: Click and drag living nodes to reposition entire cells
- **Touch Support**: Works on tablets and touch devices
- **Real-time Rendering**: 60fps smooth interactions
- **Smart Line Drawing**: Lines automatically adjust opacity inside circles

### Customization
- **Layout Controls**: Adjust cell count (1-12), spacing, overlap avoidance
- **Line Styling**: Control width, jitter for hand-drawn effect
- **Size Controls**: Customize font sizes, outline widths
- **Color Picker**: Full color customization for all elements
- **9 Function Types**: Water, Education, Green, Work, Streets, Tree, Temperature, Biodiversity, Pollution

### Export Options
- **PNG**: High-resolution (3x) export for print
- **SVG**: Vector export for infinite scaling
- **JSON**: Save/load your configurations
- **Share URL**: Generate shareable links with embedded state

## Architecture

```
webapp/
├── frontend/                # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── App.tsx          # Main app layout
│   │   │   ├── NetworkCanvas.tsx # Interactive canvas
│   │   │   └── ControlPanel.tsx  # Settings panel
│   │   ├── hooks/           # State management
│   │   │   └── useNetworkStore.ts # Zustand store
│   │   ├── utils/           # Helper functions
│   │   │   ├── geometry.ts      # Math & algorithms
│   │   │   └── export.ts        # Export utilities
│   │   ├── types/           # TypeScript types
│   │   └── styles/          # CSS styles
│   ├── Dockerfile           # Production build
│   ├── Dockerfile.dev       # Development build
│   └── nginx.conf           # Production server config
├── docker-compose.yml       # Container orchestration
└── README.md
```

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **State**: Zustand (lightweight, fast)
- **Styling**: Tailwind CSS
- **Canvas**: HTML5 Canvas API
- **Containerization**: Docker, nginx

## Configuration

All visualization parameters are customizable:

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| Cell Count | 6 | 1-12 | Number of network cells |
| Cell Spacing | 0.55 | 0.3-0.9 | Minimum distance between cells |
| Line Width | 1.6 | 0.5-4.0 | Connection line thickness |
| Line Jitter | 0 | 0-1.0 | Random variation in line width |
| Living Font | 12px | 8-24px | Living node text size |
| Function Font | 9px | 6-18px | Function node text size |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| R | Randomize layout |
| C | Randomize colors |
| E | Export PNG |
| Esc | Deselect cell |

## API Reference

### Types

```typescript
interface Cell {
  id: string;
  position: { x: number; y: number };
  radius: number;
  livingRadius: number;
  functions: FunctionNode[];
}

interface NetworkConfig {
  cellCount: number;
  cellRadius: number;
  livingRadius: number;
  functionRadius: number;
  cellSpacing: number;
  lineWidth: number;
  lineWidthJitter: number;
  showExternalConnections: boolean;
  avoidOverlap: boolean;
  linesOnTop: boolean;
}
```

### URL Sharing

The app supports URL-based state sharing. When you click "Share URL", the current state is encoded in base64 and appended to the URL. Anyone with the link will see your exact configuration.

## Performance

- Optimized rendering with smart line segmentation
- Efficient state updates with Zustand
- Canvas-based drawing for maximum performance
- Responsive design works on all screen sizes

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this for any project!

## Credits

Based on the original Python visualization tool for multi-cell network diagrams. Converted to a modern web application with enhanced interactivity and export capabilities.
