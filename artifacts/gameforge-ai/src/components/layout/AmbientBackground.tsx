/**
 * Fixed, full-viewport ambient scene — slow-drifting blurred blobs in mossy
 * green / amber / teal, plus a handful of gently rising fireflies. Sits at
 * z-0 behind all routed content so the app never reads as flat black.
 */

const FIREFLIES = [
  { left: "8%",  bottom: "10%", delay: "0s",   duration: "16s" },
  { left: "18%", bottom: "5%",  delay: "3s",   duration: "19s" },
  { left: "30%", bottom: "15%", delay: "7s",   duration: "17s" },
  { left: "45%", bottom: "8%",  delay: "1.5s", duration: "21s" },
  { left: "58%", bottom: "20%", delay: "9s",   duration: "18s" },
  { left: "70%", bottom: "6%",  delay: "4.5s", duration: "20s" },
  { left: "82%", bottom: "16%", delay: "11s",  duration: "16s" },
  { left: "92%", bottom: "9%",  delay: "6s",   duration: "22s" },
];

export default function AmbientBackground() {
  return (
    <div className="ambient-scene" aria-hidden="true">
      <div
        className="ambient-blob"
        style={{
          width: "60vw",
          height: "60vw",
          left: "-10%",
          top: "-15%",
          background: "hsl(var(--ambient-moss))",
          animation: "ambient-drift-a 42s ease-in-out infinite",
        }}
      />
      <div
        className="ambient-blob"
        style={{
          width: "50vw",
          height: "50vw",
          right: "-15%",
          top: "10%",
          background: "hsl(var(--ambient-amber))",
          opacity: 0.16,
          animation: "ambient-drift-b 55s ease-in-out infinite",
        }}
      />
      <div
        className="ambient-blob"
        style={{
          width: "55vw",
          height: "55vw",
          left: "15%",
          bottom: "-25%",
          background: "hsl(var(--ambient-teal))",
          animation: "ambient-drift-c 48s ease-in-out infinite",
        }}
      />
      {FIREFLIES.map((f, i) => (
        <span
          key={i}
          className="ambient-firefly"
          style={{
            left: f.left,
            bottom: f.bottom,
            animation: `ambient-firefly-rise ${f.duration} ease-in-out ${f.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}
