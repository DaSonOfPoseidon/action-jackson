import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Action Jackson Installs - Smart Home Networking & Automation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)",
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
              fontSize: "64px",
              fontWeight: 800,
              color: "#ffffff",
              textAlign: "center",
              lineHeight: 1.1,
            }}
          >
            Action Jackson Installs
          </div>
          <div
            style={{
              fontSize: "28px",
              color: "#22c55e",
              textAlign: "center",
              fontWeight: 500,
            }}
          >
            Smart Home Networking & Automation
          </div>
          <div
            style={{
              fontSize: "20px",
              color: "#888888",
              textAlign: "center",
              marginTop: "8px",
            }}
          >
            Engineered WiFi · VLAN Segmentation · PoE Cameras · Structured Cabling
          </div>
          <div
            style={{
              fontSize: "16px",
              color: "#666666",
              marginTop: "16px",
            }}
          >
            Columbia, MO
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
