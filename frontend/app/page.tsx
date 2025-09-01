"use client";
import React, { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type PredictResponse = {
  model: string;
  risk_percentage: number;                 // main number (adjusted if available)
  raw_risk_percentage?: number | null;     // under training prior
  adjusted_risk_percentage?: number | null;// under pi_deploy
  adjusted_for_prevalence: boolean;
  pi_train?: number | null;
  pi_deploy?: number | null;
  inputs_used?: Record<string, any>;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

// --- mapping from UI state to backend payload ---
// We only coerce numerics for age/pack_years; booleans go as-is (yes/no/0/1)
function uiToApiPayload(inputs: any) {
  const num = (v: any) => (v === "" || v == null ? 0 : Number(v));
  return {
    age: num(inputs.AGE),
    pack_years: num(inputs.PACK_YEARS),
    gender: inputs.GENDER, // 0/1 is fine; backend also accepts "0"/"1"
    radon_exposure: inputs.RADON_EXPOSURE,                 // "yes"/"no" or 0/1
    asbestos_exposure: inputs.ASBESTOS_EXPOSURE,
    secondhand_smoke_exposure: inputs.SECONDHAND_SMOKE_EXPOSURE,
    copd_diagnosis: inputs.COPD_DIAGNOSIS,
    alcohol_consumption: inputs.ALCOHOL_CONSUMPTION,
    family_history: inputs.FAMILY_HISTORY,
  };
}

async function fetchPredict(inputs: any, baselinePct?: number) {
  const payload = uiToApiPayload(inputs);
  const q = baselinePct != null ? `?pi_deploy=${(baselinePct / 100).toFixed(4)}` : "";
  const r = await fetch(`${API_BASE}/predict${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`POST /predict failed: ${r.status} ${await r.text()}`);
  return (await r.json()) as PredictResponse;
}

async function fetchModelInfo() {
  const r = await fetch(`${API_BASE}/model-info`);
  if (!r.ok) throw new Error(`GET /model-info failed: ${r.status}`);
  return r.json();
}