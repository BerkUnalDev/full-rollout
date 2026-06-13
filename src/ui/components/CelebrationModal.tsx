// src/ui/components/CelebrationModal.tsx
export function CelebrationModal({
  title, body, onClose,
}: { title: string; body: string; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ textAlign: 'center', width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 52 }}>🎉</div>
        <h3 style={{ marginTop: 8 }}>{title}</h3>
        <p>{body}</p>
        <div className="foot" style={{ justifyContent: 'center' }}>
          <button className="btn green" onClick={onClose}>Nice!</button>
        </div>
      </div>
    </div>
  );
}
