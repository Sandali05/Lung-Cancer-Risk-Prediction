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

// --- map UI state to backend payload ---
// Only coerce numerics for age/pack_years; pass strings for categories (server normalizes)
function uiToApiPayload(inputs: any) {
  const num = (v: any) => (v === "" || v == null ? 0 : Number(v));
  return {
    age: num(inputs.AGE),
    pack_years: num(inputs.PACK_YEARS),
    gender: inputs.GENDER, // 0/1 is fine; backend also accepts "male"/"female"
    radon_exposure: inputs.RADON_EXPOSURE,               // "low" | "medium" | "high"
    asbestos_exposure: inputs.ASBESTOS_EXPOSURE,         // "yes"/"no"
    secondhand_smoke_exposure: inputs.SECONDHAND_SMOKE_EXPOSURE, // "yes"/"no"
    copd_diagnosis: inputs.COPD_DIAGNOSIS,               // "yes"/"no"
    alcohol_consumption: inputs.ALCOHOL_CONSUMPTION,     // "none" | "moderate" | "heavy"
    family_history: inputs.FAMILY_HISTORY,               // "yes"/"no"
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

export default function Page() {
  // Defaults aligned to new encodings
  const [inputs, setInputs] = useState<any>({
    GENDER: 1, // 0=female, 1=male
    RADON_EXPOSURE: "low",        // "low" | "medium" | "high"
    ALCOHOL_CONSUMPTION: "none",  // "none" | "moderate" | "heavy"
    AGE: 60,
    PACK_YEARS: 20,
    ASBESTOS_EXPOSURE: "no",
    SECONDHAND_SMOKE_EXPOSURE: "no",
    COPD_DIAGNOSIS: "no",
    FAMILY_HISTORY: "no",
  });

  // Baseline slider (used as pi_deploy in %)
  const [baseline, setBaseline] = useState<number>(50);
  const [pct, setPct] = useState<string>("—");
  const [details, setDetails] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelInfo, setModelInfo] = useState<any>(null);

  useEffect(() => {
    fetchModelInfo().then(setModelInfo).catch(() => {});
  }, []);

  const onChange = (k: string, v: any) => setInputs((s: any) => ({ ...s, [k]: v }));

  const onPredict = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchPredict(inputs, baseline); // sends slider as pi_deploy
      const main = Number(data.risk_percentage) || 0;
      setPct(main.toFixed(1) + "%");
      setDetails(data);
    } catch (e: any) {
      setError(e?.message ?? "Prediction failed");
      setPct("—");
      setDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const barWidth = pct.endsWith("%") ? pct : "0%";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl p-6">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Lung Cancer Risk Predictor</h1>
            <p className="mt-1 text-gray-600">
              Enter patient factors to estimate the model&apos;s predicted probability of lung cancer.
              <span className="ml-2 text-xs text-gray-500">(Prototype; not medical advice)</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="AUC (test)" value={"0.737"} />
            <Stat label="Accuracy (test)" value={"0.840"} />
          </div>
        </header>

        <main className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="md:col-span-2 space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold">Demographics & Exposure</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Gender */}
                <div>
                  <label className="mb-1 block text-sm font-medium">Gender (0=female, 1=male)</label>
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2"
                    value={inputs.GENDER}
                    min={0}
                    max={1}
                    step={1}
                    onChange={(e) => onChange("GENDER", Number(e.target.value))}
                  />
                </div>

                {/* Radon Exposure (Low/Medium/High) */}
                <div>
                  <label className="mb-1 block text-sm font-medium">Radon Exposure</label>
                  <select
                    className="w-full rounded-xl border px-3 py-2"
                    value={inputs.RADON_EXPOSURE}
                    onChange={(e) => onChange("RADON_EXPOSURE", e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                {/* Alcohol Consumption (None/Moderate/Heavy) */}
                <div>
                  <label className="mb-1 block text-sm font-medium">Alcohol Consumption</label>
                  <select
                    className="w-full rounded-xl border px-3 py-2"
                    value={inputs.ALCOHOL_CONSUMPTION}
                    onChange={(e) => onChange("ALCOHOL_CONSUMPTION", e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="moderate">Moderate</option>
                    <option value="heavy">Heavy</option>
                  </select>
                </div>

                {/* Age */}
                <div>
                  <label className="mb-1 block text-sm font-medium">Age (years)</label>
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2"
                    value={inputs.AGE}
                    min={0}
                    onChange={(e) => onChange("AGE", Number(e.target.value))}
                  />
                </div>

                {/* Pack-years */}
                <div>
                  <label className="mb-1 block text-sm font-medium">Pack-years (smoking)</label>
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2"
                    value={inputs.PACK_YEARS}
                    min={0}
                    onChange={(e) => onChange("PACK_YEARS", Number(e.target.value))}
                  />
                </div>

                {/* Other binary features as Yes/No */}
                {(
                  [
                    ["ASBESTOS_EXPOSURE", "Asbestos exposure"],
                    ["SECONDHAND_SMOKE_EXPOSURE", "Secondhand smoke exposure"],
                    ["COPD_DIAGNOSIS", "COPD diagnosis"],
                    ["FAMILY_HISTORY", "Family history of lung cancer"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="mb-1 block text-sm font-medium">{label}</label>
                    <select
                      className="w-full rounded-xl border px-3 py-2"
                      value={(inputs as any)[key]}
                      onChange={(e) => onChange(key, e.target.value)}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold">Model Details</h2>
              <p className="text-sm text-gray-600">
                This <b>calibrated XGBoost</b> backend returns a probability. Age &amp; pack-years are standardized
                on the server; categories like Radon and Alcohol are parsed as text and one-hot encoded server-side.
              </p>
              {modelInfo && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-gray-700">See feature order</summary>
                  <div className="mt-2 text-xs text-gray-600">
                    {modelInfo.feature_order?.join(", ")}
                  </div>
                </details>
              )}
            </div>
          </section>

          <aside className="md:col-span-1">
            <div className="sticky top-6 rounded-2xl bg-white p-6 shadow">
              <h2 className="mb-2 text-xl font-semibold">Predicted Risk</h2>

              <div className="mb-2 flex items-center gap-2">
                {details?.adjusted_for_prevalence ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                    Adjusted to π<sub>deploy</sub>{details?.pi_deploy != null ? ` = ${(details.pi_deploy*100).toFixed(2)}%` : ""}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                    Using training prior (raw)
                  </span>
                )}
              </div>

              <div className="mb-4 text-5xl font-bold">{pct}</div>
              {details && (
                <div className="mb-3 text-xs text-gray-600 space-y-1">
                  {details.raw_risk_percentage != null && (
                    <div>Raw (training prior): <b>{details.raw_risk_percentage.toFixed(2)}%</b></div>
                  )}
                  {details.adjusted_risk_percentage != null && (
                    <div>Adjusted: <b>{details.adjusted_risk_percentage.toFixed(2)}%</b></div>
                  )}
                  {details.pi_train != null && (
                    <div>π<sub>train</sub>: {(details.pi_train * 100).toFixed(2)}%</div>
                  )}
                </div>
              )}

              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-200">
                <div className="h-full rounded-full bg-black" style={{ width: barWidth }} />
              </div>

              <div className="mt-6">
                <label className="mb-1 block text-sm font-medium">
                  Assumed deployment prevalence (baseline)
                </label>
                <input
                  type="range"
                  className="w-full"
                  min={1}
                  max={70}
                  step={1}
                  value={baseline}
                  onChange={(e) => setBaseline(Number(e.target.value))}
                />
                <div className="mt-1 text-xs text-gray-600">Baseline: {baseline.toFixed(0)}%</div>

                <button
                  onClick={onPredict}
                  className="mt-4 w-full rounded-xl bg-black px-4 py-2 text-white disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? "Predicting…" : "Predict"}
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}
            </div>
          </aside>
        </main>

        <footer className="mt-10 text-xs text-gray-500">
          <p>⚠️ Educational prototype only. Do not use for diagnosis or treatment decisions.</p>
        </footer>
      </div>
    </div>
  );
}
