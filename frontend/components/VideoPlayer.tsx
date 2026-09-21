"use client";
import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";

export function VideoPlayer({ lessonId }: { lessonId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    fetch(`${API_URL}/api/lessons/${lessonId}/playback-url`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => setUrl(d.url))
      .catch(() => setUrl(null));
  }, [lessonId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        const token = localStorage.getItem("auth_token");
        fetch(`${API_URL}/api/lessons/${lessonId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ watchedSeconds: Math.floor(videoRef.current.currentTime) }),
        }).catch(() => {});
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [lessonId]);

  if (!url) return <div className="aspect-video bg-black rounded-lg flex items-center justify-center text-sm text-[#B3A9C2]">Carregando vídeo…</div>;

  return (
    <video
      ref={videoRef}
      src={url}
      controls
      controlsList="nodownload"
      onContextMenu={(e) => e.preventDefault()}
      className="w-full aspect-video rounded-lg bg-black"
    />
  );
}
