import { useEffect, useId, useState } from "react";
import { sessionToken } from "@/auth/session";

export function useAffiliateSignup(product) {
  const url = `/api/affiliate/signup?product=${encodeURIComponent(product)}`;
  const [offer, setOffer] = useState(null);
  const [code, setCode] = useState("");
  const enteredCode = code.trim().toUpperCase();
  useEffect(() => {
    const request = new AbortController();
    fetch(url, { signal: request.signal })
      .then(response => response.json())
      .then(setOffer)
      .catch(() => { if (!request.signal.aborted) setOffer({ available: false }); });
    return () => request.abort();
  }, [url]);

  const validate = async () => {
    if (!enteredCode) return;
    if (!/^[A-Z0-9]{8,24}$/.test(enteredCode)) throw new Error("Kode afiliasi harus berisi 8–24 huruf atau angka.");
    const response = await fetch(url, {
      headers: { "X-Affiliate-Code": enteredCode },
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);
    if (!response?.ok) throw new Error("Kode afiliasi belum dapat diperiksa. Coba lagi.");
    const result = await response.json();
    if (result.code !== enteredCode) throw new Error("Kode afiliasi tidak ditemukan atau sudah tidak berlaku.");
  };

  const save = async () => {
    if (!enteredCode && offer && !offer.code) return true;
    try {
      const token = sessionToken();
      if (!token) return false;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(enteredCode ? { "X-Affiliate-Code": enteredCode } : {}),
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return false;
      const result = await response.json();
      return enteredCode || offer?.code ? result.code === (enteredCode || offer.code) : true;
    } catch {
      return false;
    }
  };

  return { offer, code, setCode, validate, save };
}

export function AffiliateSignupField({ referral }) {
  const id = useId();
  if (!referral.offer?.available) return null;
  if (referral.offer.code) return <p role="status" className="text-sm">Kode afiliasi <strong>{referral.offer.code}</strong> akan disimpan.</p>;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold">Punya kode afiliasi?</summary>
      <div className="mt-2 space-y-1">
        <label className="block" htmlFor={id}>Kode afiliasi (opsional)</label>
        <input className="w-full rounded-lg border px-3 py-2" id={id} name="affiliate_code"
          value={referral.code} onChange={event => referral.setCode(event.target.value)}
          maxLength={24} autoCapitalize="characters" autoComplete="off" />
      </div>
    </details>
  );
}
