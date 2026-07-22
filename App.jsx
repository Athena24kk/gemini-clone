import GeminiFullApp from "./GeminiFullApp.jsx";

export default function App() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "16px" }}>
      <div style={{ width: "100%", maxWidth: "1000px" }}>
        <GeminiFullApp />
      </div>
    </div>
  );
}
