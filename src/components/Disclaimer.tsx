export function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 ${
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
      }`}
      role="note"
    >
      <strong className="text-amber-100">Clinical decision support — not a medical device.</strong>{" "}
      Not FDA or CE cleared. For use by licensed clinicians as an adjunct only.
      Verify all values and recommendations against the patient's full clinical
      context and your institutional protocol before acting.
    </div>
  );
}
