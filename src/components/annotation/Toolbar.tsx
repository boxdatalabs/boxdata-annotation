import { MousePointer2, Square, Trash2, Download, Upload, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ToolbarProps {
  tool: "select" | "draw";
  onToolChange: (tool: "select" | "draw") => void;
  onClear: () => void;
  onExport: () => void;
  onImport: () => void;
  hasAnnotations: boolean;
  hasImage: boolean;
}

export const Toolbar = ({
  tool,
  onToolChange,
  onClear,
  onExport,
  onImport,
  hasAnnotations,
  hasImage,
}: ToolbarProps) => {
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
              <Square className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Draw Box (B)</TooltipContent>
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

      <div className="flex-1" />

      <Button
        onClick={onExport}
        disabled={!hasAnnotations}
        size="sm"
        className="gap-2"
      >
        <Download className="w-4 h-4" />
        Export YOLO
      </Button>
    </div>
  );
};
