"use client";

import React, { useEffect, useState } from "react";
import styles from "./page.module.css";

const API_STORAGE_KEY = "lung-cancer-api-base";
const FALLBACK_PI_TRAIN = 0.68728;

const sanitizeBase = (value: string): string => value.trim().replace(/\/+$/, "");

const joinUrl = (base: string, path: string): string => {
  const sanitized = sanitizeBase(base);
  if (!sanitized) return path;
  return `${sanitized}${path}`;
};

type YesNo = "yes" | "no";
type RadonLevel = "low" | "medium" | "high";
type AlcoholLevel = "none" | "moderate" | "heavy";

type UiInputs = {
  GENDER: 0 | 1;
  RADON_EXPOSURE: RadonLevel;
  ALCOHOL_CONSUMPTION: AlcoholLevel;
  AGE: number;
  PACK_YEARS: number;
  ASBESTOS_EXPOSURE: YesNo;
  SECONDHAND_SMOKE_EXPOSURE: YesNo;
  COPD_DIAGNOSIS: YesNo;
  FAMILY_HISTORY: YesNo;
};

type PredictPayload = {
  age: number;
  pack_years: number;
  gender: UiInputs["GENDER"];
  radon_exposure: UiInputs["RADON_EXPOSURE"];
  asbestos_exposure: UiInputs["ASBESTOS_EXPOSURE"];
  secondhand_smoke_exposure: UiInputs["SECONDHAND_SMOKE_EXPOSURE"];
  copd_diagnosis: UiInputs["COPD_DIAGNOSIS"];
  alcohol_consumption: UiInputs["ALCOHOL_CONSUMPTION"];
  family_history: UiInputs["FAMILY_HISTORY"];
};

type PredictResponse = {
  model: string;
  risk_percentage: number;
  raw_risk_percentage?: number | null;
  adjusted_risk_percentage?: number | null;
  adjusted_for_prevalence: boolean;
  pi_train?: number | null;
  pi_deploy?: number | null;
  inputs_used?: Record<string, string | number | boolean | null>;
  fallback?: boolean;
};

type ModelInfo = {
  feature_order?: string[];
  numeric_cols?: string[];
  binary_cols?: string[];
  one_hot_cols?: string[];
  radon_levels?: string[];
  alcohol_levels?: string[];
  pi_train?: number | null;
  pi_deploy?: number | null;
};

type StatusTone = "error" | "warning" | "success";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toBinary = (value: unknown): 0 | 1 => (toNumber(value) >= 1 ? 1 : 0);

const uiToApiPayload = (inputs: UiInputs): PredictPayload => ({
  age: toNumber(inputs.AGE),
  pack_years: toNumber(inputs.PACK_YEARS),
  gender: inputs.GENDER,
  radon_exposure: inputs.RADON_EXPOSURE,
  asbestos_exposure: inputs.ASBESTOS_EXPOSURE,
  secondhand_smoke_exposure: inputs.SECONDHAND_SMOKE_EXPOSURE,
  copd_diagnosis: inputs.COPD_DIAGNOSIS,
  alcohol_consumption: inputs.ALCOHOL_CONSUMPTION,
  family_history: inputs.FAMILY_HISTORY,
});

const fetchPredict = async (
  apiBase: string,
  inputs: UiInputs,
  baselinePct?: number
): Promise<PredictResponse> => {
  const payload = uiToApiPayload(inputs);
  const query = baselinePct != null ? `?pi_deploy=${(baselinePct / 100).toFixed(4)}` : "";
  const response = await fetch(`${joinUrl(apiBase, "/predict")}${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`POST /predict failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as PredictResponse;
};

const fetchModelInfo = async (apiBase: string): Promise<ModelInfo> => {
  const response = await fetch(joinUrl(apiBase, "/model-info"));
  if (!response.ok) {
    throw new Error(`GET /model-info failed: ${response.status}`);
  }
  return (await response.json()) as ModelInfo;
};

const networkHelp =
  "Unable to reach the prediction API. Set NEXT_PUBLIC_API_BASE during build or configure the API URL in the API Connection panel.";

const describeError = (error: unknown): string => {
  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
    return networkHelp;
  }
  if (error instanceof Error) {
    return error.message || networkHelp;
  }
  return typeof error === "string" ? error : networkHelp;
};

const logistic = (score: number): number => 1 / (1 + Math.exp(-score));

const priorAdjust = (p: number, piTrain: number, piDeploy: number): number => {
  const clamped = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
  if (!(piTrain > 0 && piTrain < 1 && piDeploy > 0 && piDeploy < 1)) {
    return clamped;
  }
  const odds = clamped / (1 - clamped);
  const adjust = (piDeploy / (1 - piDeploy)) / (piTrain / (1 - piTrain));
  return Math.min(Math.max((odds * adjust) / (1 + odds * adjust), 1e-6), 1 - 1e-6);
};

const yesNoBonus = (value: YesNo, weight: number): number => (value === "yes" ? weight : 0);

const fallbackPredict = (inputs: UiInputs, baselinePct?: number): PredictResponse => {
  const age = toNumber(inputs.AGE);
  const packs = toNumber(inputs.PACK_YEARS);

  let score = -1.45;
  score += (age - 55) * 0.035;
  score += packs * 0.022;
  score += inputs.GENDER === 1 ? 0.22 : -0.04;
  score += yesNoBonus(inputs.ASBESTOS_EXPOSURE, 0.28);
  score += yesNoBonus(inputs.SECONDHAND_SMOKE_EXPOSURE, 0.18);
  score += yesNoBonus(inputs.COPD_DIAGNOSIS, 0.32);
  score += yesNoBonus(inputs.FAMILY_HISTORY, 0.24);

  if (inputs.RADON_EXPOSURE === "medium") score += 0.18;
  if (inputs.RADON_EXPOSURE === "high") score += 0.36;
  if (inputs.ALCOHOL_CONSUMPTION === "moderate") score += 0.08;
  if (inputs.ALCOHOL_CONSUMPTION === "heavy") score += 0.18;

  const raw = logistic(score);
  const piDeploy = baselinePct != null ? Math.max(Math.min(baselinePct / 100, 0.99), 0.01) : undefined;
  const adjusted = piDeploy ? priorAdjust(raw, FALLBACK_PI_TRAIN, piDeploy) : null;
  const main = adjusted ?? raw;

  return {
    model: "Heuristic fallback (client-side)",
    risk_percentage: Number((main * 100).toFixed(2)),
    raw_risk_percentage: Number((raw * 100).toFixed(2)),
    adjusted_risk_percentage: adjusted != null ? Number((adjusted * 100).toFixed(2)) : null,
    adjusted_for_prevalence: adjusted != null,
    pi_train: FALLBACK_PI_TRAIN,
    pi_deploy: piDeploy ?? null,
    inputs_used: {
      age,
      pack_years: packs,
      gender: inputs.GENDER,
      radon_exposure: inputs.RADON_EXPOSURE,
      alcohol_consumption: inputs.ALCOHOL_CONSUMPTION,
      asbestos_exposure: inputs.ASBESTOS_EXPOSURE,
      secondhand_smoke_exposure: inputs.SECONDHAND_SMOKE_EXPOSURE,
      copd_diagnosis: inputs.COPD_DIAGNOSIS,
      family_history: inputs.FAMILY_HISTORY,
    },
    fallback: true,
  };
};

const binaryFields: Array<[
  keyof Pick<
    UiInputs,
    "ASBESTOS_EXPOSURE" | "SECONDHAND_SMOKE_EXPOSURE" | "COPD_DIAGNOSIS" | "FAMILY_HISTORY"
  >,
  string
]> = [
  ["ASBESTOS_EXPOSURE", "Asbestos exposure"],
  ["SECONDHAND_SMOKE_EXPOSURE", "Secondhand smoke exposure"],
  ["COPD_DIAGNOSIS", "COPD diagnosis"],
  ["FAMILY_HISTORY", "Family history of lung cancer"],
];

export default function Page() {
  const envApiBase = process.env.NEXT_PUBLIC_API_BASE?.trim() ?? "";
  const initialBase = envApiBase ? sanitizeBase(envApiBase) : "";
  const [inputs, setInputs] = useState<UiInputs>({
    GENDER: 1,
    RADON_EXPOSURE: "low",
    ALCOHOL_CONSUMPTION: "none",
    AGE: 60,
    PACK_YEARS: 20,
    ASBESTOS_EXPOSURE: "no",
    SECONDHAND_SMOKE_EXPOSURE: "no",
    COPD_DIAGNOSIS: "no",
    FAMILY_HISTORY: "no",
  });
  const [baseline, setBaseline] = useState<number>(50);
  const [pct, setPct] = useState<string>("—");
  const [details, setDetails] = useState<PredictResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [apiBase, setApiBase] = useState<string>(initialBase);
  const [apiInput, setApiInput] = useState<string>(initialBase);
  const [checkingApi, setCheckingApi] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    if (initialBase) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(API_STORAGE_KEY, initialBase);
      }
      return;
    }
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(API_STORAGE_KEY);
    if (stored) {
      const sanitized = sanitizeBase(stored);
      setApiBase(sanitized);
      setApiInput(sanitized);
    }
  }, [initialBase]);

  useEffect(() => {
    if (!apiBase) {
      setModelInfo(null);
      setModelError(null);
      setCheckingApi(false);
      return;
    }

    let cancelled = false;
    setCheckingApi(true);
    setModelError(null);

    fetchModelInfo(apiBase)
      .then((info) => {
        if (cancelled) return;
        setModelInfo(info);
      })
      .catch((err) => {
        if (cancelled) return;
        setModelInfo(null);
        setModelError(describeError(err));
      })
      .finally(() => {
        if (cancelled) return;
        setCheckingApi(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [justSaved]);

  const onChange = <K extends keyof UiInputs>(key: K, value: UiInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const onSaveApiBase = () => {
    const sanitized = sanitizeBase(apiInput);
    setApiInput(sanitized);
    setApiBase(sanitized);
    if (typeof window !== "undefined") {
      if (sanitized) {
        window.localStorage.setItem(API_STORAGE_KEY, sanitized);
      } else {
        window.localStorage.removeItem(API_STORAGE_KEY);
      }
    }
    setJustSaved(true);
  };

  const onClearApiBase = () => {
    setApiInput("");
    setApiBase("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(API_STORAGE_KEY);
    }
    setJustSaved(false);
  };

  const onResetApiBase = () => {
    setApiInput(initialBase);
    setApiBase(initialBase);
    if (typeof window !== "undefined") {
      if (initialBase) {
        window.localStorage.setItem(API_STORAGE_KEY, initialBase);
      } else {
        window.localStorage.removeItem(API_STORAGE_KEY);
      }
    }
    setJustSaved(false);
  };

  const runFallback = (message: string) => {
    const fallback = fallbackPredict(inputs, baseline);
    setPct(`${fallback.risk_percentage.toFixed(1)}%`);
    setDetails(fallback);
    setStatusTone("warning");
    setStatusMessage(message);
    setUsedFallback(true);
  };

  const onPredict = async () => {
    setStatusMessage(null);
    setStatusTone(null);
    setLoading(true);
    setUsedFallback(false);

    if (!apiBase) {
      runFallback("No API URL configured. Showing the built-in heuristic estimate only.");
      setLoading(false);
      return;
    }

    try {
      const data = await fetchPredict(apiBase, inputs, baseline);
      const main = Number(data.risk_percentage) || 0;
      setPct(`${main.toFixed(1)}%`);
      setDetails({ ...data, fallback: false });
      setStatusTone("success");
      setStatusMessage("Prediction received from the FastAPI backend.");
    } catch (err) {
      runFallback(`${describeError(err)} Using the built-in heuristic instead.`);
    } finally {
      setLoading(false);
    }
  };

  const barWidth = pct.endsWith("%") ? pct : "0%";
  const hasApiBase = apiBase.length > 0;
  const currentApiLabel = hasApiBase ? apiBase : "Not configured";
  const sanitizedInput = sanitizeBase(apiInput);
  const canSaveApi = sanitizedInput !== apiBase;

  const statusClass =
    statusTone === "error"
      ? `${styles.status} ${styles.statusError}`
      : statusTone === "warning"
        ? `${styles.status} ${styles.statusWarning}`
        : statusTone === "success"
          ? `${styles.status} ${styles.statusSuccess}`
          : null;

  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1>Lung Cancer Risk Predictor</h1>
            <p>
              Enter patient factors to estimate the model&apos;s predicted probability of lung cancer.
              <span>(Prototype; not medical advice)</span>
            </p>
          </div>
          <div className={styles.statGrid}>
            <Stat label="AUC (test)" value="0.737" />
            <Stat label="Accuracy (test)" value="0.840" />
          </div>
        </header>

        <main className={styles.mainContent}>
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Demographics &amp; Exposure</h2>
            <div className={styles.formGrid}>
              <div>
                <label className={styles.label}>Gender (0=female, 1=male)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={inputs.GENDER}
                  min={0}
                  max={1}
                  step={1}
                  onChange={(event) => onChange("GENDER", toBinary(event.target.value))}
                />
              </div>

              <div>
                <label className={styles.label}>Radon Exposure</label>
                <select
                  className={styles.select}
                  value={inputs.RADON_EXPOSURE}
                  onChange={(event) => onChange("RADON_EXPOSURE", event.target.value as RadonLevel)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className={styles.label}>Alcohol Consumption</label>
                <select
                  className={styles.select}
                  value={inputs.ALCOHOL_CONSUMPTION}
                  onChange={(event) => onChange("ALCOHOL_CONSUMPTION", event.target.value as AlcoholLevel)}
                >
                  <option value="none">None</option>
                  <option value="moderate">Moderate</option>
                  <option value="heavy">Heavy</option>
                </select>
              </div>

              <div>
                <label className={styles.label}>Age (years)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={inputs.AGE}
                  min={0}
                  onChange={(event) => onChange("AGE", toNumber(event.target.value))}
                />
              </div>

              <div>
                <label className={styles.label}>Pack-years (smoking)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={inputs.PACK_YEARS}
                  min={0}
                  onChange={(event) => onChange("PACK_YEARS", toNumber(event.target.value))}
                />
              </div>

              {binaryFields.map(([key, label]) => (
                <div key={key} className={styles.binaryGroup}>
                  <label className={styles.label}>{label}</label>
                  <select
                    className={styles.select}
                    value={inputs[key]}
                    onChange={(event) => onChange(key, event.target.value as YesNo)}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              ))}
            </div>

            <div className={styles.card} style={{ marginTop: 24 }}>
              <h2 className={styles.sectionTitle}>Model Details</h2>
              <p className={styles.helperText}>
                This calibrated XGBoost backend returns a probability. Age &amp; pack-years are standardized on the server;
                categories like Radon and Alcohol are parsed as text and one-hot encoded server-side.
              </p>
              {modelInfo && (
                <details className={styles.details}>
                  <summary>See feature order</summary>
                  <div className={styles.metaList}>{modelInfo.feature_order?.join(", ")}</div>
                </details>
              )}
            </div>
          </section>

          <aside>
            <div className={styles.sidebarStack}>
              <div className={styles.card}>
                <h2 className={styles.sectionTitle}>Predicted Risk</h2>
                <div className={styles.badgeRow}>
                  {details?.adjusted_for_prevalence ? (
                    <span className={styles.badgePositive}>
                      Adjusted to π<sub>deploy</sub>
                      {details?.pi_deploy != null ? ` = ${(details.pi_deploy * 100).toFixed(2)}%` : ""}
                    </span>
                  ) : (
                    <span className={styles.badgeWarning}>Using training prior (raw)</span>
                  )}
                </div>

                <div className={styles.percentDisplay}>{pct}</div>
                {details && (
                  <div className={styles.percentBreakdown}>
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

                <div className={styles.progressTrack}>
                  <div className={styles.progressBar} style={{ width: barWidth }} />
                </div>

                <div style={{ marginTop: 24 }}>
                  <div className={styles.sliderLabel}>
                    <span>Assumed deployment prevalence (baseline)</span>
                    <span>{baseline.toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    className={styles.range}
                    min={1}
                    max={70}
                    step={1}
                    value={baseline}
                    onChange={(event) => setBaseline(Number(event.target.value))}
                  />

                  <button
                    onClick={onPredict}
                    className={styles.buttonPrimary}
                    disabled={loading}
                  >
                    {loading ? "Predicting…" : hasApiBase ? "Predict" : "Predict (offline)"}
                  </button>
                </div>

                {statusMessage && statusClass && <div className={statusClass}>{statusMessage}</div>}

                {usedFallback && (
                  <div className={styles.fallbackBanner}>
                    The client-side heuristic keeps the experience working without the backend, but connect the FastAPI
                    service for calibrated probabilities.
                  </div>
                )}
              </div>

              <div className={styles.card}>
                <h2 className={styles.sectionTitle}>API Connection</h2>
                <p className={styles.helperText}>
                  Provide the base URL to your deployed FastAPI backend. The value is stored locally so future visits reuse it.
                </p>
                {initialBase && (
                  <p className={styles.helperText}>
                    Build default: <code>{initialBase}</code>
                  </p>
                )}

                <label className={styles.apiLabel}>API base URL</label>
                <input
                  type="url"
                  className={`${styles.input} ${styles.apiInput}`}
                  placeholder="https://your-backend.example.com"
                  value={apiInput}
                  onChange={(event) => setApiInput(event.target.value)}
                  autoComplete="off"
                />

                <div className={styles.actionRow}>
                  <button
                    type="button"
                    onClick={onSaveApiBase}
                    className={styles.buttonSecondary}
                    disabled={!canSaveApi}
                  >
                    Save URL
                  </button>
                  <button
                    type="button"
                    onClick={onResetApiBase}
                    className={styles.buttonGhost}
                    disabled={initialBase === apiBase && apiInput === initialBase}
                  >
                    Reset to build default
                  </button>
                  <button
                    type="button"
                    onClick={onClearApiBase}
                    className={styles.buttonGhost}
                    disabled={!hasApiBase && !apiInput}
                  >
                    Clear
                  </button>
                </div>

                <p className={styles.apiCurrent}>
                  Current: <span style={{ fontWeight: 600 }}>{currentApiLabel}</span>
                </p>

                {checkingApi && <p className={styles.helperText}>Checking API…</p>}

                {modelError && (
                  <div className={`${styles.status} ${styles.statusError}`}>{modelError}</div>
                )}

                {justSaved && !checkingApi && !modelError && hasApiBase && (
                  <div className={`${styles.status} ${styles.statusSuccess}`}>
                    Saved. Metadata will refresh automatically.
                  </div>
                )}

                {!checkingApi && !modelError && hasApiBase && modelInfo && (
                  <div className={`${styles.status} ${styles.statusSuccess}`}>
                    Model metadata loaded. π<sub>train</sub>
                    {modelInfo.pi_train != null ? ` = ${(modelInfo.pi_train * 100).toFixed(2)}%` : " unavailable"}
                  </div>
                )}

                {!hasApiBase && (
                  <div className={`${styles.status} ${styles.statusWarning}`}>
                    Paste the FastAPI deployment URL (for example, from Render or your VM). Without it the heuristic fallback
                    will be used.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </main>

        <footer className={styles.footer}>
          ⚠️ Educational prototype only. Do not use for diagnosis or treatment decisions.
        </footer>
      </div>
    </div>
  );
}
