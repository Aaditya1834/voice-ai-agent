import VapiModule from "@vapi-ai/web";
import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const vapiRef = useRef(null);
  const userSpeechEndTimeRef = useRef(null);

  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [userTranscript, setUserTranscript] = useState("");
  const [assistantTranscript, setAssistantTranscript] = useState("");
  const [latency, setLatency] = useState(null);

  const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID;
  const publicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY;

  useEffect(() => {
    const Vapi = VapiModule.default;
    const vapi = new Vapi(publicKey);

    vapiRef.current = vapi;

    vapi.on("call-start", () => {
      console.log("VAPI EVENT: call-start");
      userSpeechEndTimeRef.current = null;
      setStatus("Connected");
      setError("");
      setUserTranscript("");
      setAssistantTranscript("");
      setLatency(null);
    });

    vapi.on("call-end", () => {
      console.log("VAPI EVENT: call-end");
      setStatus("Call ended");
    });

    vapi.on("speech-start", (event) => {
      console.log("VAPI EVENT: speech-start");

      if (event?.role && event.role !== "assistant") {
        return;
      }

      if (userSpeechEndTimeRef.current !== null) {
        const responseLatency = performance.now() - userSpeechEndTimeRef.current;
        setLatency(Math.round(responseLatency));
        userSpeechEndTimeRef.current = null;
      }
    });

    vapi.on("speech-end", () => {
      console.log("VAPI EVENT: speech-end");
    });

    vapi.on("message", (message) => {
      console.log("VAPI EVENT: message", message);

      if (message.type === "transcript" && message.role === "user") {
        setLatency(null);
      }

      if (message.type === "transcript" && message.transcriptType === "final") {
        if (message.role === "user") {
          userSpeechEndTimeRef.current = performance.now();
          setUserTranscript(message.transcript);
        }

        if (message.role === "assistant") {
          setAssistantTranscript(message.transcript);
        }
      }
    });

    vapi.on("error", (error) => {
      console.error("VAPI FULL ERROR:", JSON.stringify(error, null, 2));

      setStatus("Error");

      const message =
        error?.error?.message ||
        error?.error?.error?.message ||
        error?.message ||
        JSON.stringify(error);

      setError(message);
    });

    return () => {
      vapi.stop();
      vapi.removeAllListeners();
      userSpeechEndTimeRef.current = null;

      if (vapiRef.current === vapi) {
        vapiRef.current = null;
      }
    };
  }, [publicKey]);

  const startCall = async () => {
    try {
      userSpeechEndTimeRef.current = null;
      setStatus("Connecting...");
      setError("");
      setUserTranscript("");
      setAssistantTranscript("");
      setLatency(null);

      await vapiRef.current.start(assistantId);
    } catch (error) {
      console.error("START CALL ERROR:", error);

      setStatus("Error");

      setError(error?.message || JSON.stringify(error));
    }
  };

  const endCall = () => {
    vapiRef.current?.stop();
    userSpeechEndTimeRef.current = null;
    setStatus("Call ended");
  };

  const isConnecting = status === "Connecting...";
  const isConnected = status === "Connected";
  const statusClass = status.toLowerCase().replace(/\W+/g, "-");

  return (
    <div className="voice-shell">
      <main className="voice-panel" aria-labelledby="voice-title">
        <section className="call-controls" aria-label="Voice call controls">
          <p className="eyebrow">Local Voice Agent</p>
          <h1 id="voice-title">Voice Assistant</h1>

          <div className="microphone" aria-hidden="true">
            &#127897;&#65039;
          </div>

          <button
            className="button button-primary"
            type="button"
            onClick={startCall}
            disabled={isConnecting || isConnected}
          >
            {isConnecting ? "Connecting..." : "Start Call"}
          </button>

          <div className="call-meta" aria-live="polite">
            <p>
              Status: <span className={`status ${statusClass}`}>{status}</span>
            </p>
            <p>Latency: {latency === null ? "---" : latency} ms</p>
          </div>

          <button
            className="button button-secondary"
            type="button"
            onClick={endCall}
            disabled={!isConnecting && !isConnected}
          >
            End Call
          </button>

          {error && (
            <p className="error-message" role="alert">
              Error: {error}
            </p>
          )}
        </section>

        <section className="transcripts" aria-label="Latest transcripts">
          <div className="transcript-line">
            <h2>You</h2>
            <p>{userTranscript || "No transcript yet"}</p>
          </div>

          <div className="transcript-line">
            <h2>Assistant</h2>
            <p>{assistantTranscript || "No transcript yet"}</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
