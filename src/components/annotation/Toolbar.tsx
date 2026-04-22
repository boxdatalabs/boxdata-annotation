import { MousePointer2, Square, Hexagon, Spline, Dot, Trash2, Download, Upload, RotateCcw, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiKeySettings } from "./ApiKeySettings";
import { AnnotationKind } from "@/types/annotation";

interface ToolbarProps {
  tool: "select" | "draw";
  onToolChange: (tool: "select" | "draw") => void;
  onClear: () => void;
  onExport: () => void;
  onImport: () => void;
  onAutoAnnotate?: () => void;
  isAutoAnnotating?: boolean;
  hasAnnotations: boolean;
  hasImage: boolean;
  annotationKind?: AnnotationKind;
}

export const Toolbar = ({
  tool,
  onToolChange,
  onClear,
  onExport,
  onImport,
  onAutoAnnotate,
  isAutoAnnotating,
  hasAnnotations,
  hasImage,
  annotationKind = "box",
}: ToolbarProps) => {
  const drawIcon =
    annotationKind === "polygon" ? <Hexagon className="w-4 h-4" /> :
    annotationKind === "polyline" ? <Spline className="w-4 h-4" /> :
    annotationKind === "point" ? <Dot className="w-4 h-4" /> :
    <Square className="w-4 h-4" />;
  const drawLabel =
    annotationKind === "polygon" ? "Draw Polygon (B)" :
    annotationKind === "polyline" ? "Draw Polyline (B)" :
    annotationKind === "point" ? "Place Point (B)" :
    "Draw Box (B)";
  return (
    <div className="flex items-center gap-1 p-2 bg-card border-b border-border">
      <div className="flex items-center gap-1 pr-3 border-r border-border">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onToolChange("select")}
              className={`toolbar-btn ${tool === "select" ? "toolbar-btn-active" : ""}`}
            >
              <MousePointer2 className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Select (V)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onToolChange("draw")}
              className={`toolbar-btn ${tool === "draw" ? "toolbar-btn-active" : ""}`}
            >
              {drawIcon}
            </button>
          </TooltipTrigger>
          <TooltipContent>{drawLabel}</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-1 px-3 border-r border-border">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onClear}
              disabled={!hasAnnotations}
              className="toolbar-btn disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Clear All</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onImport}
              disabled={!hasImage}
              className="toolbar-btn disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Import YOLO</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-1 px-3 border-r border-border">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onAutoAnnotate}
              disabled={!hasImage || isAutoAnnotating}
              className="toolbar-btn disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isAutoAnnotating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>Auto-annotate (OCR)</TooltipContent>
        </Tooltip>
        <ApiKeySettings />
      </div>

      <div className="flex-1" />

      <Button
        onClick={onExport}
        disabled={!hasAnnotations}
        size="sm"
        className="gap-2"
      >
        <Download className="w-4 h-4" />
        Export
      </Button>
    </div>
  );
};
