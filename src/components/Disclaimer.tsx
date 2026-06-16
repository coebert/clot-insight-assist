export function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-md border border-amber-300 bg-amber-50 text-amber-900 ${
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
      }`}
      role="note"
    >
      <strong>Clinical decision support — not a medical device.</strong>{" "}
      Not FDA or CE cleared. For use by licensed clinicians as an adjunct only.
      Verify all values and recommendations against the patient's full clinical
      context and your institutional protocol before acting.
    </div>
  );
}
