import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, login } from "../api";

const SEEDED = [
  { email: "alice@demo.test", name: "Alice" },
  { email: "bob@demo.test", name: "Bob" },
  { email: "carol@demo.test", name: "Carol" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function doLogin(address: string) {
    setBusy(true);
    setError("");
    try {
      await login(address);
      navigate("/documents");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <h1>Ajaia</h1>
      <p className="tagline">Enterprise document editor — demo</p>
      <div className="login-card">
        <div className="login-buttons">
          {SEEDED.map((u) => (
            <button key={u.email} onClick={() => doLogin(u.email)} disabled={busy}>
              {u.name}
            </button>
          ))}
        </div>
        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) doLogin(email.trim());
          }}
        >
          <input
            type="email"
            placeholder="or type a seeded email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="primary" type="submit" disabled={busy || !email.trim()}>
            Log in
          </button>
        </form>
        <p className="hint">alice@demo.test · bob@demo.test · carol@demo.test</p>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
