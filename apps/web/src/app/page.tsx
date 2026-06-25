"use client";

import React, { useState, useEffect } from "react";
import { Heart, Wind, Sparkles, Brain, Compass, Play, Square, Shield, Moon, Sun, Monitor } from "lucide-react";
import { BOX_BREATHING_PHASES } from "@anxie/shared";

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(4);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("dark");

  // Toggle Theme helper
  useEffect(() => {
    // Sync with system default
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setThemeMode(prefersDark ? "dark" : "light");
  }, []);

  // Breathing simulation loop
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            const nextIdx = (currentPhaseIdx + 1) % BOX_BREATHING_PHASES.length;
            setCurrentPhaseIdx(nextIdx);
            return BOX_BREATHING_PHASES[nextIdx].durationSeconds;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCurrentPhaseIdx(0);
      setTimeLeft(BOX_BREATHING_PHASES[0].durationSeconds);
    }
    return () => clearInterval(timer);
  }, [isPlaying, currentPhaseIdx]);

  const activePhase = BOX_BREATHING_PHASES[currentPhaseIdx];

  // Circle scaling calculation for UI
  const getCircleScale = () => {
    if (!isPlaying) return "scale-100 bg-teal-500/20 border-teal-500/40";
    
    // Inhale -> scales up, Hold (In) -> stays up, Exhale -> scales down, Hold (Out) -> stays down
    switch (activePhase.name) {
      case "Inhale":
        // Gradually scale up
        const inhaleProgress = (4 - timeLeft) / 4; // 0 to 1
        const scaleUp = 1 + inhaleProgress * 0.6; // 1.0 to 1.6
        return `scale-[${scaleUp.toFixed(2)}] bg-emerald-500/30 border-emerald-500/60 shadow-lg shadow-emerald-500/20`;
      case "Hold (In)":
        return "scale-160 bg-teal-500/30 border-teal-500/60 shadow-lg shadow-teal-500/20";
      case "Exhale":
        // Gradually scale down
        const exhaleProgress = (4 - timeLeft) / 4; // 0 to 1
        const scaleDown = 1.6 - exhaleProgress * 0.6; // 1.6 to 1.0
        return `scale-[${scaleDown.toFixed(2)}] bg-blue-500/30 border-blue-500/60 shadow-lg shadow-blue-500/20`;
      case "Hold (Out)":
        return "scale-100 bg-sky-500/20 border-sky-500/40";
      default:
        return "scale-100 bg-teal-500/20 border-teal-500/40";
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-500 ${
      themeMode === "dark" ? "bg-zinc-950 text-zinc-100" : "bg-stone-50 text-stone-900"
    }`}>
      {/* Header */}
      <header className="max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between border-b border-zinc-200/10">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-400 via-teal-500 to-blue-500 flex items-center justify-center shadow-md shadow-teal-500/20">
            <Heart className="h-5.5 w-5.5 text-white fill-white/10" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-400 bg-clip-text text-transparent">
            Anxie AI
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Theme switcher */}
          <button
            onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
            className={`p-2 rounded-lg border transition-colors ${
              themeMode === "dark"
                ? "border-zinc-800 hover:bg-zinc-900 text-zinc-400"
                : "border-stone-200 hover:bg-stone-100 text-stone-600"
            }`}
            aria-label="Toggle theme"
          >
            {themeMode === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>
          
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-teal-500/30 bg-teal-500/5 text-teal-400">
            <Sparkles className="h-3 w-3" /> Coming Soon to Mobile
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Coping details */}
        <div className="lg:col-span-7 flex flex-col gap-6 text-left">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-3.5 py-1.5 rounded-full font-medium w-fit">
            <Sparkles className="h-4 w-4" /> AI-Backed Mental Health Companion
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent dark:from-zinc-100 dark:via-zinc-200 dark:to-zinc-400 light:text-stone-900">
            A quiet space to find your{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-500 bg-clip-text text-transparent">
              breath and calm
            </span>
          </h1>

          <p className={`text-lg sm:text-xl max-w-2xl leading-relaxed ${
            themeMode === "dark" ? "text-zinc-400" : "text-stone-600"
          }`}>
            Anxie AI is designed to support you during acute panic and anxiety. Get instant access to visual, paced breathing guides and AI-led sensory grounding exercises tailored to comfort you in seconds.
          </p>

          {/* Features Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-md bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
                <Wind className="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Visual Breathing Guidance</h3>
                <p className={`text-xs ${themeMode === "dark" ? "text-zinc-500" : "text-stone-500"}`}>Paced Box Breathing with audio-visual cues.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <Brain className="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">AI Grounding Assistance</h3>
                <p className={`text-xs ${themeMode === "dark" ? "text-zinc-500" : "text-stone-500"}`}>Empathetic feedback loops using the 5-4-3-2-1 technique.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                <Compass className="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Coping Journeys</h3>
                <p className={`text-xs ${themeMode === "dark" ? "text-zinc-500" : "text-stone-500"}`}>Step-by-step calming sessions designed to lower distress.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-md bg-zinc-500/10 border border-zinc-500/20 flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
                <Shield className="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Safe & Private</h3>
                <p className={`text-xs ${themeMode === "dark" ? "text-zinc-500" : "text-stone-500"}`}>Completely anonymous check-ins. No accounts required to calm down.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mt-2">
            <button
              onClick={() => setIsPlaying(true)}
              className="px-6 py-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-medium shadow-md shadow-teal-500/15 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Play className="h-4.5 w-4.5 fill-current" />
              Try Box Breathing Now
            </button>
            <div className={`px-6 py-3.5 rounded-full border font-medium flex items-center gap-2 ${
              themeMode === "dark" ? "border-zinc-800 text-zinc-300" : "border-stone-200 text-stone-700"
            }`}>
              <Monitor className="h-4.5 w-4.5" />
              Coming to App Store
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Demo/App Preview */}
        <div className="lg:col-span-5 flex items-center justify-center">
          <div className={`relative max-w-[340px] w-full aspect-[9/18.5] rounded-[48px] border-[10px] p-6 shadow-2xl flex flex-col justify-between overflow-hidden transition-all duration-500 ${
            themeMode === "dark"
              ? "bg-zinc-900 border-zinc-800 shadow-zinc-950/50"
              : "bg-white border-stone-200 shadow-stone-200/50"
          }`}>
            {/* Phone Notch/Speaker */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-4.5 bg-black rounded-full z-20 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 absolute right-6"></div>
            </div>

            {/* In-app Screen Content */}
            <div className="flex flex-col flex-1 justify-between pt-6 pb-2">
              {/* App Header */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wider text-teal-400">ANXIE COPING KIT</span>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
              </div>

              {/* Central Breathing Circle Area */}
              <div className="flex flex-col items-center justify-center flex-1 my-6">
                <div className="relative h-44 w-44 flex items-center justify-center">
                  {/* Pulsing ring background */}
                  <div className={`absolute inset-0 rounded-full border border-teal-500/10 scale-170 ${isPlaying ? 'animate-pulse' : ''}`} />
                  <div className={`absolute inset-0 rounded-full border border-teal-500/5 scale-210 ${isPlaying ? 'animate-pulse delay-75' : ''}`} />

                  {/* Core Breathing Visual Circle */}
                  <div className={`h-28 w-28 rounded-full border-2 flex flex-col items-center justify-center transition-all duration-1000 ease-in-out ${getCircleScale()}`}>
                    <Wind className={`h-8 w-8 text-teal-400 transition-transform duration-1000 ${isPlaying && activePhase.name === "Inhale" ? "rotate-90 scale-110" : ""}`} />
                  </div>
                </div>

                {/* Coping Guidance text */}
                <div className="text-center mt-10 px-2 min-h-[72px]">
                  <p className="text-xs font-semibold tracking-wider text-teal-400 uppercase">
                    {isPlaying ? activePhase.name : "CALM DOWN NOW"}
                  </p>
                  <p className={`text-sm mt-1.5 font-medium leading-relaxed transition-opacity duration-300 ${
                    themeMode === "dark" ? "text-zinc-200" : "text-stone-800"
                  }`}>
                    {isPlaying ? activePhase.instruction : "Click Start below to begin box breathing simulation."}
                  </p>
                </div>

                {/* Seconds Counter */}
                {isPlaying && (
                  <div className="mt-4 flex items-center justify-center h-8 w-8 rounded-full bg-teal-500/10 border border-teal-500/20 text-xs font-semibold text-teal-400">
                    {timeLeft}s
                  </div>
                )}
              </div>

              {/* Action Button inside phone screen */}
              <div className="flex justify-center mt-2">
                {isPlaying ? (
                  <button
                    onClick={() => setIsPlaying(false)}
                    className="w-full py-3 rounded-2xl bg-zinc-800 border border-zinc-700/60 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" /> Stop Exercise
                  </button>
                ) : (
                  <button
                    onClick={() => setIsPlaying(true)}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 hover:brightness-110 transition-all cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" /> Start Exercise
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={`border-t py-8 mt-auto ${
        themeMode === "dark" ? "border-zinc-900 text-zinc-500" : "border-stone-200 text-stone-500"
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p>© {new Date().getFullYear()} Anxie AI. Built with care for mental wellness.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-teal-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-teal-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-teal-400 transition-colors">Support Helpline</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
