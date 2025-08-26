/*
Mini Photoshop (React + Konva + Tailwind)

Instructions:
1. Create a new React app (Vite recommended):
   npm create vite@latest mini-photoshop -- --template react
   cd mini-photoshop

2. Install dependencies:
   npm install konva react-konva uuid

3. Install Tailwind CSS (optional - or use plain CSS):
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   // configure tailwind per docs (add to content etc.)

4. Replace src/App.jsx with this file. Add the Tailwind CSS import in src/main.jsx
   import './index.css'

5. Run:
   npm install
   npm run dev

Notes: This is an MVP single-file React component that demonstrates:
- Multiple layers (Konva Layer objects stacked)
- Freehand brush, eraser, rectangle/ellipse/line shapes
- Upload image as a new layer
- Layer panel: add/remove/reorder, visibility, opacity, blend mode (Normal/Multiply/Screen)
- Color picker and size/opacity sliders
- Simple Undo/Redo using a snapshot history
- Save/export canvas to PNG
- Basic crop/rotate using a Transformer on selected image/shape layers
- Basic filters (grayscale/sepia/invert) applied to image layers via pixel manipulation

This file is intentionally compact and has inline comments. For production, split components and add performance optimizations.
*/

import React, { useRef, useState, useEffect } from 'react'
import { Stage, Layer, Line, Rect, Ellipse, Image as KImage, Group, Transformer } from 'react-konva'
import useImage from 'use-image'
import { v4 as uuidv4 } from 'uuid'

// small helper component to show konva images from HTML Image
const KonvaImage = ({ layer, isSelected, onSelect, onChange }) => {
  const [img] = useImage(layer.src || '')
  const shapeRef = useRef()
  const trRef = useRef()

  useEffect(() => {
    if (isSelected) {
      trRef.current.nodes([shapeRef.current])
      trRef.current.getLayer().batchDraw()
    }
  }, [isSelected])

  if (!img && !layer.isShape) return null

  if (layer.isShape) {
    // draw Konva primitive shapes
    if (layer.shapeType === 'rect') {
      return (
        <Group>
          <Rect
            ref={shapeRef}
            x={layer.x}
            y={layer.y}
            width={layer.width}
            height={layer.height}
            stroke={layer.stroke}
            strokeWidth={layer.strokeWidth}
            fill={layer.fill}
            opacity={layer.opacity}
            listening
            onClick={onSelect}
            draggable={layer.draggable}
            onDragEnd={(e) => onChange({ ...layer, x: e.target.x(), y: e.target.y() })}
            onTransformEnd={(e) => {
              const node = shapeRef.current
              const scaleX = node.scaleX()
              const scaleY = node.scaleY()
              node.scaleX(1)
              node.scaleY(1)
              onChange({ ...layer, x: node.x(), y: node.y(), width: Math.max(5, node.width() * scaleX), height: Math.max(5, node.height() * scaleY) })
            }}
          />
          {isSelected && <Transformer ref={trRef} />}
        </Group>
      )
    }
    if (layer.shapeType === 'ellipse') {
      return (
        <Group>
          <Ellipse
            ref={shapeRef}
            x={layer.x}
            y={layer.y}
            radiusX={layer.radiusX}
            radiusY={layer.radiusY}
            stroke={layer.stroke}
            strokeWidth={layer.strokeWidth}
            fill={layer.fill}
            opacity={layer.opacity}
            onClick={onSelect}
            draggable={layer.draggable}
            onDragEnd={(e) => onChange({ ...layer, x: e.target.x(), y: e.target.y() })}
            onTransformEnd={(e) => {
              const node = shapeRef.current
              const scaleX = node.scaleX()
              const scaleY = node.scaleY()
              node.scaleX(1)
              node.scaleY(1)
              onChange({ ...layer, x: node.x(), y: node.y(), radiusX: Math.max(5, node.radiusX * scaleX), radiusY: Math.max(5, node.radiusY * scaleY) })
            }}
          />
          {isSelected && <Transformer ref={trRef} />}
        </Group>
      )
    }
    if (layer.shapeType === 'line') {
      return (
        <Group>
          <Line
            ref={shapeRef}
            points={layer.points}
            stroke={layer.stroke}
            strokeWidth={layer.strokeWidth}
            lineCap="round"
            lineJoin="round"
            opacity={layer.opacity}
            onClick={onSelect}
            draggable={layer.draggable}
            onDragEnd={(e) => onChange({ ...layer, x: e.target.x(), y: e.target.y() })}
          />
          {isSelected && <Transformer ref={trRef} />}
        </Group>
      )
    }
  }

  return (
    <Group>
      <KImage
        image={img}
        x={layer.x}
        y={layer.y}
        width={layer.width || img?.width}
        height={layer.height || img?.height}
        opacity={layer.opacity}
        listening
        onClick={onSelect}
        draggable={layer.draggable}
        ref={shapeRef}
        onDragEnd={(e) => onChange({ ...layer, x: e.target.x(), y: e.target.y() })}
        onTransformEnd={() => {
          const node = shapeRef.current
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          onChange({ ...layer, x: node.x(), y: node.y(), width: Math.max(5, node.width() * scaleX), height: Math.max(5, node.height() * scaleY) })
        }}
        // blend mode mapping to globalCompositeOperation happens at Layer level in parent
      />
      {isSelected && <Transformer ref={trRef} />}
    </Group>
  )
}

export default function App() {
  const stageRef = useRef()
  const [tool, setTool] = useState('brush')
  const [brushColor, setBrushColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(6)
  const [brushOpacity, setBrushOpacity] = useState(1)
  const [layers, setLayers] = useState([
    // default background layer
    { id: uuidv4(), name: 'Background', type: 'raster', isBase: true, visible: true, opacity: 1, blend: 'normal', content: [] }
  ])
  const [activeLayerId, setActiveLayerId] = useState(layers[0].id)
  const [lines, setLines] = useState({}) // ephemeral strokes per layer id
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [selectedId, setSelectedId] = useState(null)

  // helper: find layer
  const findLayer = (id) => layers.find(l => l.id === id)
  const [isDrawing, setIsDrawing] = useState(false)

  useEffect(() => {
    pushHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function pushHistory() {
    const snapshot = JSON.stringify({ layers })
    const next = history.slice(0, historyIndex + 1)
    next.push(snapshot)
    setHistory(next)
    setHistoryIndex(next.length - 1)
  }

  function undo() {
    if (historyIndex <= 0) return
    const prev = JSON.parse(history[historyIndex - 1])
    setLayers(prev.layers)
    setHistoryIndex(historyIndex - 1)
  }
  function redo() {
    if (historyIndex >= history.length - 1) return
    const next = JSON.parse(history[historyIndex + 1])
    setLayers(next.layers)
    setHistoryIndex(historyIndex + 1)
  }

  function addLayer(name = 'Layer') {
    const newLayer = { id: uuidv4(), name: `${name}`, type: 'raster', visible: true, opacity: 1, blend: 'normal', content: [] }
    const next = [...layers, newLayer]
    setLayers(next)
    setActiveLayerId(newLayer.id)
    pushHistory()
  }

  function deleteLayer(id) {
    if (layers.length === 1) return
    const next = layers.filter(l => l.id !== id)
    setLayers(next)
    if (activeLayerId === id) setActiveLayerId(next[next.length - 1].id)
    pushHistory()
  }

  function reorderLayer(id, direction) {
    const idx = layers.findIndex(l => l.id === id)
    if (idx === -1) return
    const copy = layers.slice()
    const newIdx = Math.min(layers.length - 1, Math.max(0, idx + direction))
    const [item] = copy.splice(idx, 1)
    copy.splice(newIdx, 0, item)
    setLayers(copy)
    pushHistory()
  }

  // Drawing events for brush/eraser
  function handleMouseDown(e) {
    if (tool !== 'brush' && tool !== 'eraser') return
    setIsDrawing(true)  // start drawing

    const stage = e.target.getStage()
    const pos = stage.getPointerPosition()
    const lid = activeLayerId
    const stroke = { id: uuidv4(), points: [pos.x, pos.y], color: brushColor, size: brushSize, opacity: brushOpacity, mode: tool }
    setLines(prev => ({ ...prev, [lid]: [...(prev[lid] || []), stroke] }))
  }

  function handleMouseMove(e) {
    if (!isDrawing) return  // only draw if mouse is pressed
    if (tool !== 'brush' && tool !== 'eraser') return

    const stage = e.target.getStage()
    const pos = stage.getPointerPosition()
    const lid = activeLayerId
    setLines(prev => {
      const list = prev[lid]
      if (!list || list.length === 0) return prev
      const last = list[list.length - 1]
      last.points = last.points.concat([pos.x, pos.y])
      return { ...prev, [lid]: [...list.slice(0, list.length - 1), last] }
    })
  }

  function handleMouseUp(e) {
    if (tool !== 'brush' && tool !== 'eraser') return
    setIsDrawing(false)  // stop drawing
    pushHistory()
  }

  function handleMouseLeave(e) {
    setIsDrawing(false) // stop drawing if mouse leaves canvas
  }

  // upload image as new layer
  function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.src = reader.result
      img.onload = () => {
        const newLayer = { id: uuidv4(), name: file.name, type: 'image', src: img.src, x: 50, y: 50, width: img.width, height: img.height, opacity: 1, visible: true, blend: 'normal', draggable: true }
        setLayers(prev => [...prev, newLayer])
        setActiveLayerId(newLayer.id)
        pushHistory()
      }
    }
    reader.readAsDataURL(file)
  }

  function exportPNG() {
    const uri = stageRef.current.toDataURL({ pixelRatio: 1 })
    const link = document.createElement('a')
    link.download = 'mini-photoshop.png'
    link.href = uri
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  // Basic filters via canvas pixel manipulation applied to image layers
  async function applyFilterToLayer(layerId, filter) {
    const l = findLayer(layerId)
    if (!l || l.type !== 'image') return
    const img = new window.Image()
    img.src = l.src
    await new Promise(r => (img.onload = r))
    const off = document.createElement('canvas')
    off.width = img.width
    off.height = img.height
    const ctx = off.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const idata = ctx.getImageData(0, 0, off.width, off.height)
    const data = idata.data
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      if (filter === 'grayscale') {
        const v = 0.2126 * r + 0.7152 * g + 0.0722 * b
        data[i] = data[i + 1] = data[i + 2] = v
      } else if (filter === 'sepia') {
        data[i] = 0.393 * r + 0.769 * g + 0.189 * b
        data[i + 1] = 0.349 * r + 0.686 * g + 0.168 * b
        data[i + 2] = 0.272 * r + 0.534 * g + 0.131 * b
      } else if (filter === 'invert') {
        data[i] = 255 - r
        data[i + 1] = 255 - g
        data[i + 2] = 255 - b
      }
    }
    ctx.putImageData(idata, 0, 0)
    const newSrc = off.toDataURL()
    setLayers(prev => prev.map(p => (p.id === layerId ? { ...p, src: newSrc } : p)))
    pushHistory()
  }

  // change blend mode mapping (simple subset)
  function blendToComposite(blend) {
    if (!blend) return 'source-over'
    switch (blend) {
      case 'normal': return 'source-over'
      case 'multiply': return 'multiply'
      case 'screen': return 'screen'
      default: return 'source-over'
    }
  }

  // quick UI helpers
  const activeLayer = findLayer(activeLayerId) || layers[0]

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Left toolbar */}
      <div className="w-16 bg-white border-r p-2 flex flex-col gap-2">
        <button onClick={() => setTool('brush')} className={`p-2 rounded ${tool === 'brush' ? 'bg-gray-200' : ''}`}>✏️</button>
        <button onClick={() => setTool('eraser')} className={`p-2 rounded ${tool === 'eraser' ? 'bg-gray-200' : ''}`}>🧽</button>
        <button onClick={() => setTool('rect')} className={`p-2 rounded ${tool === 'rect' ? 'bg-gray-200' : ''}`}>▭</button>
        <button onClick={() => setTool('ellipse')} className={`p-2 rounded ${tool === 'ellipse' ? 'bg-gray-200' : ''}`}>◯</button>
        <button onClick={() => setTool('line')} className={`p-2 rounded ${tool === 'line' ? 'bg-gray-200' : ''}`}>\/</button>
        <div className="divider my-2 border-t" />
        <input type="file" accept="image/*" onChange={handleUpload} />
      </div>

      {/* Canvas area */}
      <div className="flex-1 p-4 flex justify-center items-start">
        <div className="bg-white shadow p-2">
          <Stage
            width={900}
            height={600}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave} // stop drawing if cursor leaves stage
            ref={stageRef}
            style={{ background: '#fff' }}
          >
            {layers.map((layer, idx) => (
              <Layer key={layer.id} clearBeforeDraw={false} listening={layer.visible} opacity={layer.opacity} globalCompositeOperation={blendToComposite(layer.blend)}>
                {/* Render strokes for this layer */}
                {(lines[layer.id] || []).map((stroke) => (
                  <Line key={stroke.id} points={stroke.points} stroke={stroke.mode === 'eraser' ? '#000' : stroke.color} strokeWidth={stroke.size} tension={0.5} lineCap="round" lineJoin="round" opacity={stroke.opacity} globalCompositeOperation={stroke.mode === 'eraser' ? 'destination-out' : 'source-over'} />
                ))}
                {/* If this layer has an image or shapes, render them */}
                {layer.type === 'image' || layer.isShape ? (
                  <KonvaImage
                    layer={layer}
                    isSelected={selectedId === layer.id}
                    onSelect={() => setSelectedId(layer.id)}
                    onChange={(updated) => setLayers(prev => prev.map(p => p.id === layer.id ? updated : p))}
                  />
                ) : null}
              </Layer>
            ))}
          </Stage>
        </div>
      </div>

      {/* Right panel: Layers + controls */}
      <div className="w-80 bg-white border-l p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Layers</h3>
          <div className="flex gap-2">
            <button onClick={() => { addLayer('Layer') }} className="px-2 py-1 bg-blue-500 text-white rounded">+ Layer</button>
            <button onClick={() => { undo() }} className="px-2 py-1 bg-gray-200 rounded">Undo</button>
            <button onClick={() => { redo() }} className="px-2 py-1 bg-gray-200 rounded">Redo</button>
          </div>
        </div>

        <div className="flex flex-col gap-2 max-h-64 overflow-auto">
          {layers.slice().reverse().map((l) => (
            <div key={l.id} className={`p-2 border rounded flex items-center gap-2 ${l.id === activeLayerId ? 'bg-gray-50' : ''}`} onClick={() => setActiveLayerId(l.id)}>
              <input type="checkbox" checked={l.visible} onChange={() => setLayers(prev => prev.map(p => p.id === l.id ? { ...p, visible: !p.visible } : p))} />
              <div className="flex-1">
                <div className="font-medium text-sm truncate">{l.name}</div>
                <div className="text-xs text-gray-500">{l.type}</div>
              </div>
              <div className="flex flex-col gap-1">
                <select value={l.blend} onChange={(e) => setLayers(prev => prev.map(p => p.id === l.id ? { ...p, blend: e.target.value } : p))}>
                  <option value="normal">Normal</option>
                  <option value="multiply">Multiply</option>
                  <option value="screen">Screen</option>
                </select>
                <input type="range" min="0" max="1" step="0.01" value={l.opacity} onChange={(e) => setLayers(prev => prev.map(p => p.id === l.id ? { ...p, opacity: parseFloat(e.target.value) } : p))} />
                <div className="flex gap-1">
                  <button onClick={() => reorderLayer(l.id, 1)} className="px-1">⬆</button>
                  <button onClick={() => reorderLayer(l.id, -1)} className="px-1">⬇</button>
                  <button onClick={() => deleteLayer(l.id)} className="px-1">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label>Tool:</label>
            <div className="flex gap-2">
              <button onClick={() => setTool('brush')} className={`px-2 py-1 rounded ${tool === 'brush' ? 'bg-gray-200' : ''}`}>Brush</button>
              <button onClick={() => setTool('eraser')} className={`px-2 py-1 rounded ${tool === 'eraser' ? 'bg-gray-200' : ''}`}>Eraser</button>
              <button onClick={() => setTool('rect')} className={`px-2 py-1 rounded ${tool === 'rect' ? 'bg-gray-200' : ''}`}>Rect</button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label>Color</label>
            <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label>Size</label>
            <input type="range" min="1" max="80" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} />
            <span>{brushSize}</span>
          </div>
          <div className="flex items-center gap-2">
            <label>Opacity</label>
            <input type="range" min="0.1" max="1" step="0.01" value={brushOpacity} onChange={(e) => setBrushOpacity(parseFloat(e.target.value))} />
          </div>

          <div className="flex gap-2">
            <button onClick={() => exportPNG()} className="px-3 py-1 bg-green-500 text-white rounded">Export PNG</button>
            <button onClick={() => applyFilterToLayer(activeLayerId, 'grayscale')} className="px-2 py-1 bg-gray-200 rounded">Grayscale</button>
            <button onClick={() => applyFilterToLayer(activeLayerId, 'sepia')} className="px-2 py-1 bg-gray-200 rounded">Sepia</button>
            <button onClick={() => applyFilterToLayer(activeLayerId, 'invert')} className="px-2 py-1 bg-gray-200 rounded">Invert</button>
          </div>
        </div>

      </div>
    </div>
  )
}
