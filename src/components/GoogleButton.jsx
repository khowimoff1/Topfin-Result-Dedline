import { useEffect, useRef } from "react";

// Google'ning rasmiy "Sign in with Google" tugmasi (Google Identity Services).
let scriptPromise = null;

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Google bilan bog'lanib bo'lmadi. Internetni tekshiring."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function GoogleButton({ clientId, onCredential, onError }) {
  const box = useRef(null);
  const handlers = useRef({ onCredential, onError });

  useEffect(() => {
    handlers.current = { onCredential, onError };
  });

  useEffect(() => {
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !box.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => handlers.current.onCredential(response.credential),
        });
        window.google.accounts.id.renderButton(box.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "signin_with",
          locale: "uz",
          width: 300,
        });
      })
      .catch((err) => handlers.current.onError?.(err.message));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return <div ref={box} className="google-btn" />;
}
