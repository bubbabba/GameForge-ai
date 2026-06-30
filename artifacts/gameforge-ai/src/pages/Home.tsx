import React, { useState } from 'react';
import { useGenerateGame } from '@workspace/api-client-react';
import { Terminal, Gamepad2, Sparkles, AlertTriangle, Zap, Code2 } from 'lucide-react';

const GENRES = [
  'Platformer',
  'Horror',
  'Shooter',
  'Puzzle',
  'Racing',
  'RPG'
] as const;

type Genre = typeof GENRES[number];

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState<Genre>('Platformer');
  
  const generateGame = useGenerateGame();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    generateGame.mutate({
      data: {
        prompt: prompt.trim(),
        genre
      }
    });
  };
  
  const isPending = generateGame.isPending;
  const isError = generateGame.isError;
  const error = generateGame.error;
  const data = generateGame.data;
  
  const errorMessage = (error as any)?.data?.error ?? error?.message ?? "Generation failed";

  return (
    <div className="min-h-[100dvh] w-full bg-[#050505] text-gray-300 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,240,255,0.05)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20 mix-blend-overlay" />
      </div>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-16 flex flex-col gap-12">
        {/* Header */}
        <header className="flex flex-col items-center text-center gap-4 animate-in fade-in slide-in-from-top-8 duration-700">
          <div className="inline-flex items-center justify-center p-3 bg-cyan-950/30 border border-cyan-500/30 rounded-2xl shadow-[0_0_30px_rgba(0,240,255,0.15)] mb-2">
            <Gamepad2 className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white uppercase" style={{ fontFamily: 'var(--font-display)' }}>
            GameForge <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">AI</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl font-medium tracking-wide">
            Describe it. Forge it. Play it.
          </p>
        </header>

        {/* Form area */}
        <div className="grid grid-cols-1 gap-8 w-full max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-1 bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl shadow-2xl relative group">
            <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-500/50 via-purple-500/50 to-cyan-500/50 rounded-2xl blur-[2px] opacity-20 group-hover:opacity-40 transition duration-500" />
            <div className="relative bg-[#0A0A0C] rounded-xl p-6 md:p-8 flex flex-col gap-6 border border-gray-800">
              
              <div className="flex flex-col gap-3">
                <label htmlFor="prompt" className="flex items-center gap-2 text-sm font-semibold tracking-widest text-cyan-400 uppercase">
                  <Terminal className="w-4 h-4" /> System Prompt
                </label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isPending}
                  placeholder="A retro platformer where I play as a robotic cat escaping a neon factory..."
                  className="w-full h-32 bg-gray-950/50 border border-gray-800 rounded-lg p-4 text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all resize-none font-mono text-sm leading-relaxed shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
                />
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex flex-col gap-3 flex-1">
                  <label htmlFor="genre" className="flex items-center gap-2 text-sm font-semibold tracking-widest text-purple-400 uppercase">
                    <Code2 className="w-4 h-4" /> Framework Genre
                  </label>
                  <div className="relative">
                    <select
                      id="genre"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value as Genre)}
                      disabled={isPending}
                      className="w-full appearance-none bg-gray-950/50 border border-gray-800 rounded-lg p-4 text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all font-mono text-sm cursor-pointer shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
                    >
                      {GENRES.map(g => (
                        <option key={g} value={g} className="bg-gray-900">{g}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                      ▼
                    </div>
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isPending || !prompt.trim()}
                    className="w-full md:w-auto px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase tracking-widest rounded-lg flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)]"
                  >
                    {isPending ? (
                      <>
                        <Zap className="w-5 h-5 animate-pulse" />
                        Forging...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Generate Game
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Results Area */}
        <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
          {isPending && (
            <div className="w-full aspect-video bg-gray-900/50 border border-gray-800 rounded-2xl flex flex-col items-center justify-center gap-6 shadow-2xl overflow-hidden relative">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjMDBmMGZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-50" />
              <div className="relative flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-gray-800 border-t-cyan-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 w-20 h-20 border-4 border-gray-800 border-b-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold tracking-widest text-white uppercase font-display">Forging your world</h3>
                  <p className="text-cyan-400 font-mono text-sm animate-pulse">Compiling mechanics... Rendering sprites...</p>
                </div>
              </div>
            </div>
          )}

          {isError && !isPending && (
            <div className="w-full p-8 bg-red-950/20 border border-red-900/50 rounded-2xl flex flex-col items-center justify-center gap-4 text-center">
              <div className="p-4 bg-red-900/20 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-red-400">Forge Malfunction</h3>
              <p className="text-red-300/80 max-w-lg">{errorMessage}</p>
            </div>
          )}

          {data && !isPending && !isError && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-2xl font-bold text-white uppercase tracking-wider flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
                  <span className="w-2 h-8 bg-cyan-500 inline-block rounded-sm shadow-[0_0_10px_rgba(0,240,255,0.5)]" />
                  {data.title || 'Untitled Prototype'}
                </h2>
                <div className="px-3 py-1 bg-cyan-950/50 border border-cyan-800/50 text-cyan-400 text-xs font-mono rounded uppercase tracking-widest shadow-[0_0_10px_rgba(0,240,255,0.1)]">
                  System: Online
                </div>
              </div>
              <div className="w-full aspect-video bg-black border border-gray-800 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative group">
                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] z-10" />
                <iframe
                  srcDoc={data.gameCode}
                  sandbox="allow-scripts"
                  className="w-full h-full border-none bg-black relative z-0"
                  title={data.title}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
