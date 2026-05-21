import { useRef, useState, useCallback, useEffect } from "react";
import { BoundingBox, AnnotationClass, DrawingState, ImageData, AnnotationKind, Point } from "@/types/annotation";
import { ZoomIn, ZoomOut, Maximize, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ResizeHandle = "nw" | "ne" | "sw" | "se";

interface CanvasProps {
  image: ImageData | null;
  annotations: BoundingBox[];
  classes: AnnotationClass[];
  selectedClassId: number | null;
  selectedAnnotationId: string | null;
  tool: "select" | "draw";
  annotationKind?: AnnotationKind;
  onAddAnnotation: (box: Omit<BoundingBox, "id">) => void;
  onUpdateAnnotation: (id: string, updates: Partial<BoundingBox>) => void;
  onSelectAnnotation: (id: string | null) => void;
}

export const Canvas = ({
  image,
  annotations,
  classes,
  selectedClassId,
  selectedAnnotationId,
  tool,
  annotationKind = "box",
  onAddAnnotation,
  onUpdateAnnotation,
  onSelectAnnotation,
}: CanvasProps) => {
  const fallbackClass: AnnotationClass = {
    id: -1,
    name: "Unassigned",
    color: "hsl(var(--muted-foreground))",
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const [polyPoints, setPolyPoints] = useState<Point[]>([]);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; anchorX: number; anchorY: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 5;
  const ZOOM_STEP = 0.25;

  useEffect(() => {
    if (!containerRef.current || !image) return;

    const updateSize = () => {
      const container = containerRef.current!;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      setContainerSize({ width: containerWidth, height: containerHeight });

      const imageAspect = image.width / image.height;
      const containerAspect = containerWidth / containerHeight;

      let displayWidth: number;
      let displayHeight: number;
      if (imageAspect > containerAspect) {
        displayWidth = containerWidth;
        displayHeight = containerWidth / imageAspect;
      } else {
        displayHeight = containerHeight;
        displayWidth = containerHeight * imageAspect;
      }
      setCanvasSize({ width: displayWidth, height: displayHeight });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [image]);

  useEffect(() => {
    setZoom(1);
    setPolyPoints([]);
  }, [image]);

  // Reset in-progress polygon if kind/tool changes
  useEffect(() => {
    setPolyPoints([]);
    setDrawing(null);
  }, [annotationKind, tool]);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
    container.scrollTop = (container.scrollHeight - container.clientHeight) / 2;
  }, [zoom, canvasSize]);

  const handleZoomIn = useCallback(() => setZoom((p) => Math.min(MAX_ZOOM, p + ZOOM_STEP)), []);
  const handleZoomOut = useCallback(() => setZoom((p) => Math.max(MIN_ZOOM, p - ZOOM_STEP)), []);
  const handleResetZoom = useCallback(() => setZoom(1), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((p) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, p + delta)));
    }
  }, []);

  const getMousePosition = useCallback(
    (e: React.MouseEvent): Point => {
      if (!scrollContainerRef.current) return { x: 0, y: 0 };
      const sc = scrollContainerRef.current;
      const rect = sc.getBoundingClientRect();
      const scaledWidth = canvasSize.width * zoom;
      const scaledHeight = canvasSize.height * zoom;
      const paddingX = Math.max(containerSize.width / 2, scaledWidth / 2);
      const paddingY = Math.max(containerSize.height / 2, scaledHeight / 2);
      const imageLeft = paddingX - scaledWidth / 2;
      const imageTop = paddingY - scaledHeight / 2;
      const x = (e.clientX - rect.left + sc.scrollLeft - imageLeft) / scaledWidth;
      const y = (e.clientY - rect.top + sc.scrollTop - imageTop) / scaledHeight;
      return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    },
    [canvasSize, containerSize, zoom]
  );

  const finishPolygon = useCallback(
    (closed: boolean) => {
      if (polyPoints.length < (closed ? 3 : 2)) {
        setPolyPoints([]);
        return;
      }
      onAddAnnotation({
        classId: selectedClassId,
        kind: closed ? "polygon" : "polyline",
        points: polyPoints,
      });
      setPolyPoints([]);
    },
    [polyPoints, selectedClassId, onAddAnnotation]
  );

  // Cancel polygon on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPolyPoints([]);
      if (e.key === "Enter" && polyPoints.length >= 2) {
        finishPolygon(annotationKind === "polygon");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [polyPoints, annotationKind, finishPolygon]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!image || tool !== "draw" || selectedClassId === null) return;
      const pos = getMousePosition(e);

      if (annotationKind === "box") {
        setDrawing({ isDrawing: true, startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y });
        onSelectAnnotation(null);
      } else if (annotationKind === "point") {
        onAddAnnotation({ classId: selectedClassId, kind: "point", points: [pos] });
      } else {
        // polygon / polyline: each click adds a vertex
        setPolyPoints((prev) => {
          // Click near start to close polygon
          if (annotationKind === "polygon" && prev.length >= 3) {
            const start = prev[0];
            const dx = (pos.x - start.x) * canvasSize.width * zoom;
            const dy = (pos.y - start.y) * canvasSize.height * zoom;
            if (Math.sqrt(dx * dx + dy * dy) < 10) {
              onAddAnnotation({ classId: selectedClassId, kind: "polygon", points: prev });
              return [];
            }
          }
          return [...prev, pos];
        });
      }
    },
    [image, tool, selectedClassId, annotationKind, getMousePosition, onSelectAnnotation, onAddAnnotation, canvasSize, zoom]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pos = getMousePosition(e);
      setHoverPoint(pos);
      if (drawing) {
        setDrawing((prev) => (prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null));
      } else if (resizing) {
        const minX = Math.max(0, Math.min(resizing.anchorX, pos.x));
        const maxX = Math.min(1, Math.max(resizing.anchorX, pos.x));
        const minY = Math.max(0, Math.min(resizing.anchorY, pos.y));
        const maxY = Math.min(1, Math.max(resizing.anchorY, pos.y));
        const width = Math.max(0.005, maxX - minX);
        const height = Math.max(0.005, maxY - minY);
        onUpdateAnnotation(resizing.id, {
          x: minX + width / 2,
          y: minY + height / 2,
          width,
          height,
        });
      } else if (dragging) {
        const ann = annotations.find((a) => a.id === dragging.id);
        if (ann && ann.kind !== "polygon" && ann.kind !== "polyline" && (ann.kind === "box" || !ann.kind)) {
          const w = ann.width ?? 0;
          const h = ann.height ?? 0;
          const newX = Math.max(w / 2, Math.min(1 - w / 2, pos.x - dragging.offsetX + w / 2));
          const newY = Math.max(h / 2, Math.min(1 - h / 2, pos.y - dragging.offsetY + h / 2));
          onUpdateAnnotation(dragging.id, { x: newX, y: newY });
        }
      }
    },
    [drawing, resizing, dragging, annotations, getMousePosition, onUpdateAnnotation]
  );

  const handleMouseUp = useCallback(() => {
    if (drawing) {
      const minX = Math.min(drawing.startX, drawing.currentX);
      const maxX = Math.max(drawing.startX, drawing.currentX);
      const minY = Math.min(drawing.startY, drawing.currentY);
      const maxY = Math.max(drawing.startY, drawing.currentY);
      const width = maxX - minX;
      const height = maxY - minY;
      if (width > 0.01 && height > 0.01) {
        onAddAnnotation({
          classId: selectedClassId,
          kind: "box",
          x: minX + width / 2,
          y: minY + height / 2,
          width,
          height,
        });
      }
      setDrawing(null);
    }
    if (resizing) setResizing(null);
    if (dragging) setDragging(null);
  }, [drawing, resizing, dragging, selectedClassId, onAddAnnotation]);

  const handleBoxMouseDown = useCallback(
    (e: React.MouseEvent, ann: BoundingBox) => {
      e.stopPropagation();
      if (tool !== "select") return;
      onSelectAnnotation(ann.id);
      const kind = ann.kind ?? "box";
      if (kind === "box") {
        const pos = getMousePosition(e);
        const boxLeft = (ann.x ?? 0) - (ann.width ?? 0) / 2;
        const boxTop = (ann.y ?? 0) - (ann.height ?? 0) / 2;
        setDragging({ id: ann.id, offsetX: pos.x - boxLeft, offsetY: pos.y - boxTop });
      }
    },
    [tool, getMousePosition, onSelectAnnotation]
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, ann: BoundingBox, handle: ResizeHandle) => {
      e.stopPropagation();
      if (tool !== "select") return;
      onSelectAnnotation(ann.id);
      const left = (ann.x ?? 0) - (ann.width ?? 0) / 2;
      const right = (ann.x ?? 0) + (ann.width ?? 0) / 2;
      const top = (ann.y ?? 0) - (ann.height ?? 0) / 2;
      const bottom = (ann.y ?? 0) + (ann.height ?? 0) / 2;
      setDragging(null);
      setResizing({
        id: ann.id,
        anchorX: handle.includes("w") ? right : left,
        anchorY: handle.includes("n") ? bottom : top,
      });
    },
    [tool, onSelectAnnotation]
  );

  const getClass = (classId: number) =>
    classes.find((c) => c.id === classId) || classes[0] || fallbackClass;

  const scaledWidth = canvasSize.width * zoom;
  const scaledHeight = canvasSize.height * zoom;
  const paddingX = Math.max(containerSize.width / 2, scaledWidth / 2);
  const paddingY = Math.max(containerSize.height / 2, scaledHeight / 2);

  const cursor =
    tool === "draw" && (annotationKind === "polygon" || annotationKind === "polyline" || annotationKind === "point")
      ? "crosshair"
      : tool === "draw"
      ? "crosshair"
      : "default";

  // Render an annotation as SVG element (polygon, polyline, point) or div (box)
  const renderAnnotation = (ann: BoundingBox) => {
    const cls = getClass(ann.classId);
    const kind = ann.kind ?? "box";
    const isSel = selectedAnnotationId === ann.id;

    if (kind === "box") {
      const left = ((ann.x ?? 0) - (ann.width ?? 0) / 2) * 100;
      const top = ((ann.y ?? 0) - (ann.height ?? 0) / 2) * 100;
      return (
        <div
          key={ann.id}
          className={`annotation-box ${isSel ? "annotation-box-selected" : ""}`}
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${(ann.width ?? 0) * 100}%`,
            height: `${(ann.height ?? 0) * 100}%`,
            borderColor: cls.color,
            backgroundColor: "transparent",
          }}
          onMouseDown={(e) => handleBoxMouseDown(e, ann)}
        >
          <span
            className="absolute -top-5 left-0 text-xs font-medium px-1 rounded whitespace-nowrap"
            style={{ backgroundColor: cls.color, color: "hsl(var(--background))" }}
          >
            {cls.name}
          </span>
          {isSel && tool === "select" && (["nw", "ne", "sw", "se"] as ResizeHandle[]).map((handle) => (
            <button
              key={handle}
              type="button"
              aria-label={`Resize ${handle}`}
              className={`absolute z-10 h-3 w-3 rounded-full border-2 border-background bg-primary ${
                handle === "nw" ? "-left-1.5 -top-1.5 cursor-nwse-resize" :
                handle === "ne" ? "-right-1.5 -top-1.5 cursor-nesw-resize" :
                handle === "sw" ? "-left-1.5 -bottom-1.5 cursor-nesw-resize" :
                "-right-1.5 -bottom-1.5 cursor-nwse-resize"
              }`}
              onMouseDown={(e) => handleResizeMouseDown(e, ann, handle)}
            />
          ))}
        </div>
      );
    }
    return null;
  };

  // SVG overlay points for polygons / polylines / points (uses pixel coordinates relative to image)
  const renderSvgAnnotations = () => (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${scaledWidth || 1} ${scaledHeight || 1}`}
      preserveAspectRatio="none"
    >
      {annotations.map((ann) => {
        const kind = ann.kind ?? "box";
        if (kind === "box") return null;
        const cls = getClass(ann.classId);
        const pts = ann.points ?? [];
        const isSel = selectedAnnotationId === ann.id;
        const stroke = cls.color;
        const fill = cls.color.replace(")", " / 0.15)");
        const strokeW = isSel ? 3 : 2;
        const px = pts.map((p) => ({ x: p.x * scaledWidth, y: p.y * scaledHeight }));

        const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (tool === "select") onSelectAnnotation(ann.id);
        };

        if (kind === "polygon") {
          const d = px.map((p) => `${p.x},${p.y}`).join(" ");
          return (
            <g key={ann.id} className="pointer-events-auto" onMouseDown={handleClick}>
              <polygon points={d} fill={fill} stroke={stroke} strokeWidth={strokeW} />
              {px[0] && (
                <text x={px[0].x} y={px[0].y - 6} fill={stroke} fontSize={12} fontWeight={600}>
                  {cls.name}
                </text>
              )}
            </g>
          );
        }
        if (kind === "polyline") {
          const d = px.map((p) => `${p.x},${p.y}`).join(" ");
          return (
            <g key={ann.id} className="pointer-events-auto" onMouseDown={handleClick}>
              <polyline points={d} fill="none" stroke={stroke} strokeWidth={strokeW} />
              {px.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill={stroke} />
              ))}
              {px[0] && (
                <text x={px[0].x} y={px[0].y - 6} fill={stroke} fontSize={12} fontWeight={600}>
                  {cls.name}
                </text>
              )}
            </g>
          );
        }
        if (kind === "point") {
          const p = px[0];
          if (!p) return null;
          return (
            <g key={ann.id} className="pointer-events-auto" onMouseDown={handleClick}>
              <circle cx={p.x} cy={p.y} r={isSel ? 7 : 5} fill={stroke} stroke="hsl(var(--background))" strokeWidth={2} />
              <text x={p.x + 8} y={p.y - 6} fill={stroke} fontSize={12} fontWeight={600}>
                {cls.name}
              </text>
            </g>
          );
        }
        return null;
      })}

      {/* In-progress polygon / polyline */}
      {polyPoints.length > 0 && selectedClassId !== null && (
        <g>
          {(() => {
            const cls = getClass(selectedClassId);
            const px = polyPoints.map((p) => ({ x: p.x * scaledWidth, y: p.y * scaledHeight }));
            const hover = hoverPoint ? { x: hoverPoint.x * scaledWidth, y: hoverPoint.y * scaledHeight } : null;
            const allPts = hover ? [...px, hover] : px;
            const d = allPts.map((p) => `${p.x},${p.y}`).join(" ");
            return (
              <>
                <polyline
                  points={d}
                  fill="none"
                  stroke={cls.color}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
                {annotationKind === "polygon" && hover && px[0] && (
                  <line
                    x1={hover.x}
                    y1={hover.y}
                    x2={px[0].x}
                    y2={px[0].y}
                    stroke={cls.color}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    opacity={0.5}
                  />
                )}
                {px.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 5 : 3} fill={cls.color} />
                ))}
              </>
            );
          })()}
        </g>
      )}

      {/* Box drawing preview */}
      {drawing && selectedClassId !== null && (() => {
        const cls = getClass(selectedClassId);
        const minX = Math.min(drawing.startX, drawing.currentX) * scaledWidth;
        const minY = Math.min(drawing.startY, drawing.currentY) * scaledHeight;
        const w = Math.abs(drawing.currentX - drawing.startX) * scaledWidth;
        const h = Math.abs(drawing.currentY - drawing.startY) * scaledHeight;
        return (
          <rect
            x={minX}
            y={minY}
            width={w}
            height={h}
            fill="none"
            stroke={cls.color}
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        );
      })()}
    </svg>
  );

  return (
    <div ref={containerRef} className="flex-1 annotation-canvas relative overflow-hidden" onWheel={handleWheel}>
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-card/90 backdrop-blur-sm rounded-lg p-1 border border-border shadow-lg">
        <Button variant="ghost" size="sm" onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM} className="h-8 w-8 p-0">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs font-mono w-12 text-center text-foreground">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="sm" onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM} className="h-8 w-8 p-0">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="ghost" size="sm" onClick={handleResetZoom} disabled={zoom === 1} className="h-8 w-8 p-0">
          <Maximize className="w-4 h-4" />
        </Button>
      </div>

      {/* Polygon controls */}
      {polyPoints.length > 0 && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-card/95 backdrop-blur-sm rounded-lg p-2 border border-border shadow-lg">
          <span className="text-xs text-muted-foreground">
            {polyPoints.length} pts • {annotationKind === "polygon" ? "click first point or Enter to close" : "Enter to finish"}
          </span>
          <Button size="sm" variant="default" onClick={() => finishPolygon(annotationKind === "polygon")} className="h-7 gap-1">
            <Check className="w-3 h-3" /> Finish
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPolyPoints([])} className="h-7 gap-1">
            <X className="w-3 h-3" /> Cancel
          </Button>
        </div>
      )}

      {image ? (
        <div
          ref={scrollContainerRef}
          className="w-full h-full overflow-auto scrollbar-thin"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor }}
        >
          <div
            className="flex items-center justify-center"
            style={{ width: paddingX * 2, height: paddingY * 2, minWidth: "100%", minHeight: "100%" }}
          >
            <div className="relative flex-shrink-0" style={{ width: scaledWidth, height: scaledHeight }}>
              <img
                src={image.src}
                alt={image.name}
                className="w-full h-full object-contain pointer-events-none select-none"
                draggable={false}
              />
              {annotations.map(renderAnnotation)}
              {renderSvgAnnotations()}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-center text-muted-foreground">
          <div>
            <div className="text-6xl mb-4">🖼️</div>
            <p className="text-lg font-medium">No image loaded</p>
            <p className="text-sm mt-1">Upload an image to start annotating</p>
          </div>
        </div>
      )}

      {image && zoom === 1 && (
        <div className="absolute bottom-3 right-3 z-10 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded">
          <kbd className="px-1 py-0.5 bg-muted rounded">Ctrl</kbd> + scroll to zoom
        </div>
      )}
    </div>
  );
};
