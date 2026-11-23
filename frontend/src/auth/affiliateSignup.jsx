import { useEffect, useId, useState } from "react";
import { sessionToken } from "@/auth/session";

const affiliateCodePattern = /^[A-Z0-9]{8,24}$/;

export function affiliateCodeFromSearch(search) {
  const code = (new URLSearchParams(search).get("affiliate") || "").toUpperCase();
  return affiliateCodePattern.test(code) ? code : "";
}

export function withAffiliateCode(path, code) {
  return code ? `${path}${path.includes("?") ? "&" : "?"}affiliate=${encodeURIComponent(code)}` : path;
}

export function useAffiliateSignup(product, linkedCode = "") {
  const url = `/api/affiliate/signup?product=${encodeURIComponent(product)}`;
  const [offer, setOffer] = useState(null);
  const [code, setCode] = useState(linkedCode);
  const enteredCode = code.trim().toUpperCase();
  useEffect(() => {
    const request = new AbortController();
    fetch(url, { signal: request.signal })
      .then(response => {
        if (!response.ok) throw new Error("Affiliate lookup failed");
        return response.json();
      })
      .then(setOffer)
      .catch(() => { if (!request.signal.aborted) setOffer({ available: false, unknown: true }); });
    return () => request.abort();
  }, [url]);

  const validate = async () => {
    if (!enteredCode) return;
    if (!affiliateCodePattern.test(enteredCode)) throw new Error("Kode afiliasi harus berisi 8–24 huruf atau angka.");
    const response = await fetch(url, {
      headers: { "X-Affiliate-Code": enteredCode },
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);
    if (!response?.ok) throw new Error("Kode afiliasi belum dapat diperiksa. Coba lagi.");
    const result = await response.json();
    if (result.code !== enteredCode) throw new Error("Kode afiliasi tidak ditemukan atau sudah tidak berlaku.");
  };

  const save = async () => {
    // A pending or failed lookup may hide a referral cookie. Do not claim it was saved.
    // The caller keeps the trial and tells the owner how to enter the code at checkout.
    if (!enteredCode && linkedCode) return true; // The customer removed the imported code.
    if (!enteredCode && (!offer || offer.unknown)) return false;
    if (!enteredCode && !offer.code) return true;
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

  return { offer, code, linkedCode, setCode, validate, save };
}

export function AffiliateSignupField({ referral, androidProduct }) {
  const id = useId();
  if (!referral.offer?.available && !referral.linkedCode) return null;
  if (referral.offer?.code && !referral.linkedCode) {
    const code = referral.offer.code;
    const canOpenApp = ["geraina", "dapuros"].includes(androidProduct) && /Android/i.test(navigator.userAgent)
      && !window.GerainaNative && !/GerainaAndroid|DapurOSAndroid/i.test(navigator.userAgent) && affiliateCodePattern.test(code);
    const fallback = encodeURIComponent(`https://dagangos.com/${androidProduct}/register`);
    return <div className="space-y-2 text-sm">
      <p role="status">Kode afiliasi <strong>{code}</strong> akan disimpan.</p>
      {canOpenApp && <a className="btn-outline inline-flex" href={`intent://dagangos.com/${androidProduct}/affiliate-signup/${code}#Intent;scheme=https;package=com.dagangos.${androidProduct};S.browser_fallback_url=${fallback};end`}>Lanjutkan di aplikasi Android</a>}
    </div>;
  }
  return (
    <details className="text-sm" open={referral.linkedCode ? true : undefined}>
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
