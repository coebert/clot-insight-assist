export function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-md border border-warning/40 bg-warning/10 text-warning ${
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
      }`}
      role="note"
    >
      <strong className="text-warning">Clinical decision support — not FDA or CE cleared.</strong>{" "}
      For use by licensed clinicians as an adjunct only.
      Verify all values and recommendations against the patient's full clinical
      context and your institutional protocol before acting. Major haemorrhage escalation must not wait for complete TEG. No validated local obstetric algorithm configured.
    </div>
  );
}
