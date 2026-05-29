import { X } from "lucide-react";

interface Props {
  src: string | null;
  onClose: () => void;
}

export function ImageLightbox({ src, onClose }: Props) {
  if (!src) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "zoom-out",
        animation: "fadeIn 0.15s ease",
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 16, right: 16,
          background: "rgba(255,255,255,0.15)", border: "none",
          borderRadius: "50%", width: 40, height: 40,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", cursor: "pointer", zIndex: 1001,
          backdropFilter: "blur(8px)",
        }}
      >
        <X size={20} />
      </button>
      <img
        src={src}
        alt="预览"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "92vw", maxHeight: "90vh",
          objectFit: "contain", borderRadius: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      />
    </div>
  );
}
