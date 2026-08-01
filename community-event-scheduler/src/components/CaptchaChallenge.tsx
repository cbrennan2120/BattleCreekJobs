import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

export interface CaptchaChallengeHandle { reset: (message?: string) => void }

interface Props {
  siteKey?: string;
  onTokenChange: (token: string) => void;
}

const CaptchaChallenge = forwardRef<CaptchaChallengeHandle, Props>(function CaptchaChallenge({ siteKey, onTokenChange }, forwardedRef) {
  const widget = useRef<TurnstileInstance | null>(null);
  const [message, setMessage] = useState("");

  const reset = (nextMessage = "The spam-protection check was refreshed. Please complete it again.") => {
    onTokenChange("");
    setMessage(nextMessage);
    widget.current?.reset();
  };

  useImperativeHandle(forwardedRef, () => ({ reset }));
  if (!siteKey) return null;

  return (
    <div className="turnstile-wrap">
      <Turnstile
        ref={widget}
        siteKey={siteKey}
        onSuccess={(token) => { onTokenChange(token); setMessage("Spam-protection check complete."); }}
        onExpire={() => reset("The spam-protection check expired. Complete the refreshed check to continue.")}
        onError={() => {
          onTokenChange("");
          setMessage("The spam-protection check could not finish. Use Retry to request a fresh challenge.");
        }}
        options={{ theme: "light", refreshExpired: "manual", size: "flexible" }}
      />
      <p className="captcha-status" role="status" aria-live="polite">{message}</p>
      {message.includes("could not") && <button type="button" className="button ghost small" onClick={() => reset()}>Retry spam-protection check</button>}
    </div>
  );
});

export default CaptchaChallenge;
