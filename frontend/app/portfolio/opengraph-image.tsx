import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Jackson Keithley - Full-Stack Developer & Automation Engineer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 50%, #0a0a0a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <div
            style={{
              width: "96px",
              height: "96px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #a855f7, #ec4899)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "40px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            JK
          </div>
          <div
            style={{
              fontSize: "56px",
              fontWeight: 800,
              color: "#ffffff",
              textAlign: "center",
              lineHeight: 1.1,
            }}
          >
            Jackson Keithley
          </div>
          <div
            style={{
              fontSize: "28px",
              background: "linear-gradient(90deg, #a855f7, #ec4899, #22c55e)",
              backgroundClip: "text",
              color: "transparent",
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            Full-Stack Developer & Automation Engineer
          </div>
          <div
            style={{
              fontSize: "20px",
              color: "#22c55e",
              border: "1px solid #22c55e44",
              borderRadius: "8px",
              padding: "8px 24px",
              marginTop: "8px",
            }}
          >
            Available for Hire
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
