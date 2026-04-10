import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { VideoSegment } from "@/types/annotation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import JSZip from "jszip";
import {
  ArrowLeft,
  Upload,
  Play,
  Pause,
  Scissors,
  Trash2,
  Download,
  Plus,
  Save,
  Loader2,
} from "lucide-react";

// WAV encoding helper
function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

async function extractAudioSegment(
  videoFile: File,
  startTime: number,
  endTime: number
): Promise<ArrayBuffer> {
  const audioCtx = new OfflineAudioContext(1, 44100 * (endTime - startTime), 44100);
  const arrayBuffer = await videoFile.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  source.start(0, startTime, endTime - startTime);

  const rendered = await audioCtx.startRendering();
  const samples = rendered.getChannelData(0);
  return encodeWAV(samples, 44100);
}

export const VideoAnnotationTool = () => {
  const { projectId } = useParams<{ taskId: string; projectId: string }>();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [markStart, setMarkStart] = useState<number | null>(null);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);

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
      setVideoFile(file);
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
    if (video.paused) { video.play(); setIsPlaying(true); }
    else { video.pause(); setIsPlaying(false); }
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
    if (markStart === null) { toast.error("Mark start time first"); return; }
    if (currentTime <= markStart) { toast.error("End time must be after start time"); return; }
    const segment: VideoSegment = {
      id: crypto.randomUUID(),
      startTime: markStart,
      endTime: currentTime,
      label: "",
    };
    setSegments((prev) => [...prev, segment]);
    setEditingSegmentId(segment.id);
    setMarkStart(null);
    toast.success(`Segment created: ${formatTime(segment.startTime)} → ${formatTime(segment.endTime)}`);
  }, [markStart, currentTime]);

  const updateSegmentLabel = useCallback(
    (id: string, value: string) => {
      setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, label: value } : s)));
    },
    []
  );

  const deleteSegment = useCallback((id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
    toast.info("Segment deleted");
  }, []);

  const seekToSegment = useCallback((seg: VideoSegment) => {
    if (videoRef.current) videoRef.current.currentTime = seg.startTime;
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

  const handleExportZip = useCallback(async () => {
    if (segments.length === 0) { toast.error("No segments to export"); return; }
    if (!videoFile) { toast.error("No video file loaded"); return; }

    setIsExporting(true);
    try {
      const zip = new JSZip();
      const speechFolder = zip.folder("speech")!;

      let labelLines: string[] = [];

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const cropName = `crop${i + 1}`;
        toast.info(`Extracting ${cropName}... (${i + 1}/${segments.length})`);

        const wavData = await extractAudioSegment(videoFile, seg.startTime, seg.endTime);
        speechFolder.file(`${cropName}.wav`, wavData);

        const label = seg.label || "(no label)";
        labelLines.push(`speech/${cropName} : ${label}`);
      }

      zip.file("labels.txt", labelLines.join("\n"));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${videoName.replace(/\.[^/.]+$/, "")}_annotations.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${segments.length} segments as ZIP`);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Export failed. The browser may not support this video's audio format.");
    } finally {
      setIsExporting(false);
    }
  }, [segments, videoFile, videoName]);

  const handleExportJSON = useCallback(() => {
    if (segments.length === 0) { toast.error("No segments to export"); return; }
    const exportData = {
      videoName,
      segments: segments.map((s, i) => ({
        cropName: `crop${i + 1}`,
        startTime: Number(s.startTime.toFixed(3)),
        endTime: Number(s.endTime.toFixed(3)),
        duration: Number((s.endTime - s.startTime).toFixed(3)),
        label: s.label,
      })),
      exportedAt: new Date().toISOString(),
      totalSegments: segments.length,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoName.replace(/\.[^/.]+$/, "")}_annotations.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${segments.length} segments as JSON`);
  }, [segments, videoName]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/project/${projectId}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">S</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Speech-to-Text Annotation</h1>
            <p className="text-xs text-muted-foreground">Crop video segments, add labels, export as WAV + labels</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {segments.length} segment{segments.length !== 1 ? "s" : ""}
          </span>
          <Button onClick={handleExportJSON} disabled={segments.length === 0} size="sm" variant="outline">
            <Download className="w-4 h-4 mr-2" />
            JSON
          </Button>
          <Button onClick={handleExportZip} disabled={segments.length === 0 || isExporting} size="sm">
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isExporting ? "Exporting..." : "Export ZIP"}
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
                  <p className="text-lg font-medium text-foreground mb-1">Upload a Video</p>
                  <p className="text-sm text-muted-foreground">MP4, WebM, or OGG format</p>
                </div>
                <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
              </label>
            </div>
          ) : (
            <>
              <div className="flex-1 flex items-center justify-center bg-black/90 p-4 min-h-0">
                <video ref={videoRef} src={videoSrc} className="max-w-full max-h-full rounded" onClick={togglePlay} />
              </div>

              {/* Controls + Timeline */}
              <div className="border-t border-border bg-card px-4 py-3 space-y-3">
                <div
                  ref={timelineRef}
                  className="relative h-10 bg-muted rounded cursor-pointer group"
                  onClick={handleTimelineClick}
                >
                  {segments.map((seg, i) => (
                    <div
                      key={seg.id}
                      className="absolute top-0 h-full rounded opacity-60 hover:opacity-90 transition-opacity"
                      style={{
                        left: `${(seg.startTime / duration) * 100}%`,
                        width: `${((seg.endTime - seg.startTime) / duration) * 100}%`,
                        backgroundColor: `hsl(${(i * 60) % 360}, 70%, 50%)`,
                      }}
                      title={`Crop ${i + 1}: ${formatTime(seg.startTime)} → ${formatTime(seg.endTime)}`}
                    />
                  ))}
                  {markStart !== null && (
                    <div
                      className="absolute top-0 h-full bg-primary/30 border-l-2 border-primary"
                      style={{
                        left: `${(markStart / duration) * 100}%`,
                        width: `${(Math.max(0, currentTime - markStart) / duration) * 100}%`,
                      }}
                    />
                  )}
                  <div
                    className="absolute top-0 h-full w-0.5 bg-foreground z-10"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" onClick={togglePlay}>
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <span className="text-sm font-mono text-muted-foreground min-w-[120px]">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  <div className="flex-1" />
                  <Button variant={markStart !== null ? "default" : "outline"} size="sm" onClick={handleMarkStart}>
                    <Scissors className="w-4 h-4 mr-1" />Mark Start
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleMarkEnd} disabled={markStart === null}>
                    <Plus className="w-4 h-4 mr-1" />Mark End
                  </Button>
                  {markStart !== null && (
                    <span className="text-xs text-muted-foreground">Start: {formatTime(markStart)}</span>
                  )}
                  <label className="cursor-pointer">
                    <Button variant="ghost" size="sm" asChild>
                      <span><Upload className="w-4 h-4 mr-1" />Change Video</span>
                    </Button>
                    <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right sidebar — Segment list */}
        <aside className="w-80 border-l border-border bg-sidebar flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Segments ({segments.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {segments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Use Mark Start / Mark End to crop segments from the video timeline.
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
                        style={{ backgroundColor: `hsl(${(i * 60) % 360}, 70%, 50%)`, color: "white" }}
                      >
                        Crop {i + 1}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatTime(seg.startTime)} → {formatTime(seg.endTime)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={(e) => { e.stopPropagation(); seekToSegment(seg); }}>
                        Seek
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={(e) => { e.stopPropagation(); playSegment(seg); }}>
                        <Play className="w-3 h-3 mr-1" />Play
                      </Button>
                      <div className="flex-1" />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); deleteSegment(seg.id); }}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-muted-foreground font-medium">Label</label>
                      <Input
                        value={seg.label}
                        onChange={(e) => updateSegmentLabel(seg.id, e.target.value)}
                        placeholder="វាយអក្សរ / Type label..."
                        className="h-8 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
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
        <span>Video: <span className="text-foreground font-medium">{videoName || "None"}</span></span>
        <span>|</span>
        <span>Segments: <span className="text-foreground font-medium">{segments.length}</span></span>
        {markStart !== null && (
          <>
            <span>|</span>
            <span className="text-primary font-medium">Recording from {formatTime(markStart)}...</span>
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
