import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordInput({ id, toggleTestId, style, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);
  return <div style={{ position: "relative", width: "100%" }}>
    <input {...props} id={inputId} type={visible ? "text" : "password"} style={{ ...style, width: "100%", paddingRight: 48 }} />
    <button type="button" data-testid={toggleTestId} aria-controls={inputId} aria-pressed={visible}
      aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
      onClick={() => setVisible(value => !value)}
      style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, display: "grid", placeItems: "center", color: "#38633f", background: "transparent", border: 0, borderRadius: 10 }}>
      {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  </div>;
}
