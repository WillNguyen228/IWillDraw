import React from "react";

export default function LayersPanel({
  layers,
  setLayers,
  activeLayerId,
  setActiveLayerId,
  addLayer,
  deleteLayer,
  reorderLayer,
  mergeUpLayer,
  mergeDownLayer,
}) {
  function toggleVisibility(id) {
    setLayers(prev =>
      prev.map(l => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  }

  function changeOpacity(id, value) {
    setLayers(prev =>
      prev.map(l => (l.id === id ? { ...l, opacity: value } : l))
    );
  }

  function changeBlendMode(id, value) {
    setLayers(prev =>
      prev.map(l => (l.id === id ? { ...l, blend: value } : l))
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <h2 className="font-bold">Layers</h2>
        <button
          onClick={() => addLayer(`Layer ${layers.length + 1}`)}
          className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
        >
          +
        </button>
      </div>

      <div className="space-y-2">
        {layers.map((layer, index) => (
          <div
            key={layer.id}
            className="p-2 rounded border bg-gray-50"
          >
            <div className="flex justify-between items-center mb-1">
              <span>{layer.name}</span>
              <div className="flex gap-1">
                {/* Visibility toggle */}
                <button
                  onClick={() => toggleVisibility(layer.id)}
                  className="px-1"
                >
                  {layer.visible ? "👁" : "🚫"}
                </button>

                {/* Select layer button */}
                <button
                  onClick={() => setActiveLayerId(layer.id)}
                  className={`px-2 py-1 rounded text-sm ${
                    activeLayerId === layer.id
                      ? "bg-blue-500 text-white font-semibold"
                      : "bg-gray-200"
                  }`}
                >
                  Select
                </button>
              </div>
            </div>

            {/* Reorder / Merge buttons */}
            <div className="flex justify-between gap-1 mt-1 text-xs">
              <div className="flex gap-1">
                <button
                  onClick={() => reorderLayer(layer.id, -1)}
                  disabled={index === 0}
                  className="px-2 py-1 bg-gray-200 rounded"
                >
                  ↑
                </button>
                <button
                  onClick={() => reorderLayer(layer.id, 1)}
                  disabled={index === layers.length - 1}
                  className="px-2 py-1 bg-gray-200 rounded"
                >
                  ↓
                </button>
              </div>
              <div className="flex justify-end mt-1 text-xs gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); mergeUp(layer.id); }}
                  className="text-green-600"
                  disabled={layers[0].id === layer.id} // topmost layer cannot merge up
                >
                  Merge Up
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); mergeDown(layer.id); }}
                  className="text-green-600"
                  disabled={layers[layers.length - 1].id === layer.id} // bottommost layer cannot merge down
                >
                  Merge Down
                </button>
              </div>
            </div>

            {/* Opacity slider */}
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={layer.opacity}
              onChange={(e) => changeOpacity(layer.id, parseFloat(e.target.value))}
              className="w-full mt-1"
            />

            {/* Blend mode dropdown */}
            <select
              value={layer.blend}
              onChange={(e) => changeBlendMode(layer.id, e.target.value)}
              className="w-full text-sm mt-1"
            >
              <option value="normal">Normal</option>
              <option value="multiply">Multiply</option>
              <option value="screen">Screen</option>
              <option value="overlay">Overlay</option>
            </select>

            {/* Delete button */}
            <div className="flex justify-end mt-1 text-xs">
              <button
                onClick={() => deleteLayer(layer.id)}
                className="text-red-500"
                disabled={layer.isBase}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
