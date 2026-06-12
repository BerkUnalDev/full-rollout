// src/ui/components/HowToPlayModal.tsx
export function HowToPlayModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal howto">
        <h3>🚀 Welcome to Full Rollout</h3>
        <p className="sub">You run a mobile game studio. Don't go broke.</p>
        <ul>
          <li>📨 <strong>Inbox:</strong> accept feature requests and bug reports — they become tickets.</li>
          <li>📋 <strong>Board:</strong> assign developers; tickets flow Dev → QA → QA Complete each week.</li>
          <li>📦 <strong>Releases:</strong> bundle QA-complete work, soft-launch to 10%, read the report card.</li>
          <li>✅ <strong>Full Rollout</strong> good releases for growth — pull back bad ones before they tank your rating.</li>
          <li>💸 Stale games decay, salaries are weekly. Ship, grow, buy more games — survive.</li>
        </ul>
        <div className="foot">
          <button className="btn blue" onClick={onClose}>Let's ship</button>
        </div>
      </div>
    </div>
  );
}
