"use client";
import { useState } from "react";
import { API_URL } from "@/lib/api";

export default function CheckoutPage({ params }: { params: { courseId: string } }) {
  const [url, setUrl] = useState("");
  async function checkout(gateway: "stripe" | "mercadopago") {
    const token = localStorage.getItem("auth_token");
    const res = await fetch(`${API_URL}/api/checkout/${gateway}`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ courseId: params.courseId }),
    });
    const data = await res.json();
    setUrl(data.url);
    window.location.href = data.url;
  }
  return (
    <main className="max-w-sm mx-auto min-h-screen p-6">
      <h1 className="font-bebas text-3xl mb-4">Checkout</h1>
      <p className="text-xs text-[#B3A9C2] mb-4">O acesso é liberado via webhook do gateway — nunca só pela tela de sucesso.</p>
      <div className="space-y-2">
        <button onClick={() => checkout("stripe")} className="w-full bg-white text-black font-bold text-sm p-3 rounded">Pagar com cartão (Stripe)</button>
        <button onClick={() => checkout("mercadopago")} className="w-full bg-[#00B1EA] font-bold text-sm p-3 rounded">Pagar com Pix/Boleto (MP)</button>
      </div>
      {url && <p className="text-[11px] mt-3 break-all">{url}</p>}
    </main>
  );
}
