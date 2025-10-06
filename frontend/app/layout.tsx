import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lung Cancer Risk Predictor",
  description:
    "Interactive risk calculator for the calibrated XGBoost lung cancer model. Prototype for educational use only.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
