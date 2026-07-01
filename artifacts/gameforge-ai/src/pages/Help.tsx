import { HelpCircle, Sparkles, Globe, Code2, Heart } from "lucide-react";

export default function Help() {
  return (
    <div className="flex-1 px-6 lg:px-12 py-12 max-w-4xl mx-auto w-full">
      <div className="mb-12 text-center">
        <div className="w-16 h-16 mx-auto bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(34,197,94,0.15)]">
          <HelpCircle className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-display font-bold mb-4">How can we help?</h1>
        <p className="text-lg text-muted-foreground">Everything you need to know about GameForge AI.</p>
      </div>

      <div className="space-y-8">
        <div className="bg-card border border-border p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-display font-bold">Creating Games</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-4">
            GameForge uses advanced AI to turn your ideas into playable browser games. Simply describe what you want on the Dashboard, pick a genre, and hit "Create Game".
          </p>
          <ul className="list-disc list-inside text-muted-foreground ml-4 space-y-2">
            <li><strong>Be specific:</strong> "A platformer where a cat collects fish" works better than "a cool game".</li>
            <li><strong>Mention mechanics:</strong> Mention if you want WASD controls, a scoring system, or specific enemies.</li>
            <li><strong>Try different genres:</strong> The AI adapts the code structure based on the genre you select.</li>
          </ul>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <Code2 className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-display font-bold">Editing Code</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Not quite perfect? Once you save a game as a draft, you can open it in the Editor. You'll have full access to the HTML, CSS, and JavaScript that powers your game. Make tweaks, change values, and hit "Apply Changes" to see the preview update instantly.
          </p>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-display font-bold">Publishing & Sharing</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-4">
            When you're proud of your creation, hit Publish from the Editor or My Games page.
          </p>
          <ul className="list-disc list-inside text-muted-foreground ml-4 space-y-2">
            <li>Published games appear in the Community Explore tab.</li>
            <li>You get a unique, shareable URL that anyone can play without logging in.</li>
            <li>Other users can like your game.</li>
          </ul>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <Heart className="w-6 h-6 text-rose-500" />
            <h2 className="text-xl font-display font-bold">Community Rules</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            GameForge is a platform for creativity. We ask that all prompts and generated content remain appropriate for a general audience. Games containing explicit content, hate speech, or malicious code will be removed.
          </p>
        </div>
      </div>
    </div>
  );
}