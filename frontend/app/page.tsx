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
