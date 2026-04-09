import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { VideoSegment } from "@/types/annotation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  Play,
  Pause,
  Scissors,
  Trash2,
  Download,
  Plus,
} from "lucide-react";

export const VideoAnnotationTool = () => {
  const { projectId } = useParams<{ taskId: string; projectId: string }>();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Segment creation
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [markStart, setMarkStart] = useState<number | null>(null);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);

  // Timeline scrubbing
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration);
    const onEnded = () => setIsPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("ended", onEnded);
    };
  }, [videoSrc]);

  const handleVideoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setVideoName(file.name);
      setSegments([]);
      setMarkStart(null);
      setCurrentTime(0);
      setIsPlaying(false);
      toast.success(`Video "${file.name}" loaded`);
    },
    [videoSrc]
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current || !videoRef.current || !duration) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      videoRef.current.currentTime = ratio * duration;
    },
    [duration]
  );

  const handleMarkStart = useCallback(() => {
    setMarkStart(currentTime);
    toast.info(`Start marked at ${formatTime(currentTime)}`);
  }, [currentTime]);

  const handleMarkEnd = useCallback(() => {
    if (markStart === null) {
      toast.error("Mark start time first");
      return;
    }
    if (currentTime <= markStart) {
      toast.error("End time must be after start time");
      return;
    }
    const segment: VideoSegment = {
      id: crypto.randomUUID(),
      startTime: markStart,
      endTime: currentTime,
      labelKhmer: "",
      labelEnglish: "",
    };
    setSegments((prev) => [...prev, segment]);
    setEditingSegmentId(segment.id);
    setMarkStart(null);
    toast.success(`Segment created: ${formatTime(segment.startTime)} → ${formatTime(segment.endTime)}`);
  }, [markStart, currentTime]);

  const updateSegmentLabel = useCallback(
    (id: string, field: "labelKhmer" | "labelEnglish", value: string) => {
      setSegments((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
      );
    },
    []
  );

  const deleteSegment = useCallback((id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
    toast.info("Segment deleted");
  }, []);

  const seekToSegment = useCallback((seg: VideoSegment) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seg.startTime;
    }
  }, []);

  const playSegment = useCallback((seg: VideoSegment) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seg.startTime;
    video.play();
    setIsPlaying(true);

    const checkEnd = () => {
      if (video.currentTime >= seg.endTime) {
        video.pause();
        setIsPlaying(false);
        video.removeEventListener("timeupdate", checkEnd);
      }
    };
    video.addEventListener("timeupdate", checkEnd);
  }, []);

  const handleExport = useCallback(() => {
    if (segments.length === 0) {
      toast.error("No segments to export");
      return;
    }
    const exportData = {
      videoName,
      segments: segments.map((s) => ({
        startTime: Number(s.startTime.toFixed(3)),
        endTime: Number(s.endTime.toFixed(3)),
        duration: Number((s.endTime - s.startTime).toFixed(3)),
        labelKhmer: s.labelKhmer,
        labelEnglish: s.labelEnglish,
      })),
      exportedAt: new Date().toISOString(),
      totalSegments: segments.length,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoName.replace(/\.[^/.]+$/, "")}_annotations.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${segments.length} segments`);
  }, [segments, videoName]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/project/${projectId}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">S</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Speech-to-Text Annotation
            </h1>
            <p className="text-xs text-muted-foreground">
              Crop video segments and add Khmer/English labels
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {segments.length} segment{segments.length !== 1 ? "s" : ""}
          </span>
          <Button onClick={handleExport} disabled={segments.length === 0} size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main video area */}
        <div className="flex-1 flex flex-col">
          {!videoSrc ? (
            <div className="flex-1 flex items-center justify-center">
              <label className="cursor-pointer">
                <div className="border-2 border-dashed border-border rounded-xl p-16 text-center hover:border-primary/50 transition-colors">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium text-foreground mb-1">
                    Upload a Video
                  </p>
                  <p className="text-sm text-muted-foreground">
                    MP4, WebM, or OGG format
                  </p>
                </div>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <>
              {/* Video player */}
              <div className="flex-1 flex items-center justify-center bg-black/90 p-4 min-h-0">
                <video
                  ref={videoRef}
                  src={videoSrc}
                  className="max-w-full max-h-full rounded"
                  onClick={togglePlay}
                />
              </div>

              {/* Controls + Timeline */}
              <div className="border-t border-border bg-card px-4 py-3 space-y-3">
                {/* Timeline */}
                <div
                  ref={timelineRef}
                  className="relative h-10 bg-muted rounded cursor-pointer group"
                  onClick={handleTimelineClick}
                >
                  {/* Segments on timeline */}
                  {segments.map((seg, i) => (
                    <div
                      key={seg.id}
                      className="absolute top-0 h-full rounded opacity-60 hover:opacity-90 transition-opacity"
                      style={{
                        left: `${(seg.startTime / duration) * 100}%`,
                        width: `${((seg.endTime - seg.startTime) / duration) * 100}%`,
                        backgroundColor: `hsl(${(i * 60) % 360}, 70%, 50%)`,
                      }}
                      title={`Segment ${i + 1}: ${formatTime(seg.startTime)} → ${formatTime(seg.endTime)}`}
                    />
                  ))}
                  {/* Mark start indicator */}
                  {markStart !== null && (
                    <div
                      className="absolute top-0 h-full bg-primary/30 border-l-2 border-primary"
                      style={{
                        left: `${(markStart / duration) * 100}%`,
                        width: `${(Math.max(0, currentTime - markStart) / duration) * 100}%`,
                      }}
                    />
                  )}
                  {/* Playhead */}
                  <div
                    className="absolute top-0 h-full w-0.5 bg-foreground z-10"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                  />
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" onClick={togglePlay}>
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  <span className="text-sm font-mono text-muted-foreground min-w-[120px]">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>

                  <div className="flex-1" />

                  <Button
                    variant={markStart !== null ? "default" : "outline"}
                    size="sm"
                    onClick={handleMarkStart}
                  >
                    <Scissors className="w-4 h-4 mr-1" />
                    Mark Start
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkEnd}
                    disabled={markStart === null}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Mark End
                  </Button>
                  {markStart !== null && (
                    <span className="text-xs text-muted-foreground">
                      Start: {formatTime(markStart)}
                    </span>
                  )}

                  <label className="cursor-pointer">
                    <Button variant="ghost" size="sm" asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-1" />
                        Change Video
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right sidebar — Segment list */}
        <aside className="w-80 border-l border-border bg-sidebar flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">
              Segments ({segments.length})
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {segments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Use Mark Start / Mark End to create segments from the video
                timeline.
              </p>
            ) : (
              segments.map((seg, i) => (
                <Card
                  key={seg.id}
                  className={`transition-colors ${editingSegmentId === seg.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setEditingSegmentId(seg.id)}
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: `hsl(${(i * 60) % 360}, 70%, 50%)`,
                          color: "white",
                        }}
                      >
                        #{i + 1}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatTime(seg.startTime)} → {formatTime(seg.endTime)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          seekToSegment(seg);
                        }}
                      >
                        Seek
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          playSegment(seg);
                        }}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Play
                      </Button>
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSegment(seg.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <label className="text-[10px] uppercase text-muted-foreground font-medium">
                          Khmer (ខ្មែរ)
                        </label>
                        <Input
                          value={seg.labelKhmer}
                          onChange={(e) =>
                            updateSegmentLabel(seg.id, "labelKhmer", e.target.value)
                          }
                          placeholder="វាយអក្សរខ្មែរ..."
                          className="h-8 text-sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-muted-foreground font-medium">
                          English
                        </label>
                        <Input
                          value={seg.labelEnglish}
                          onChange={(e) =>
                            updateSegmentLabel(seg.id, "labelEnglish", e.target.value)
                          }
                          placeholder="Type English text..."
                          className="h-8 text-sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Status bar */}
      <footer className="px-4 py-2 border-t border-border bg-card text-xs text-muted-foreground flex items-center gap-4">
        <span>
          Video:{" "}
          <span className="text-foreground font-medium">
            {videoName || "None"}
          </span>
        </span>
        <span>|</span>
        <span>
          Segments:{" "}
          <span className="text-foreground font-medium">{segments.length}</span>
        </span>
        {markStart !== null && (
          <>
            <span>|</span>
            <span className="text-primary font-medium">
              Recording from {formatTime(markStart)}...
            </span>
          </>
        )}
      </footer>
    </div>
  );
};

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00.0";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}
