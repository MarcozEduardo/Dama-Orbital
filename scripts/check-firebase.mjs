/** Diagnóstico somente-leitura: Auth anônimo + leitura autenticada das Rules. */
const apiKey = process.env.FIREBASE_API_KEY;
const databaseUrl = process.env.FIREBASE_DATABASE_URL;

if (!apiKey || !databaseUrl) {
  console.error("Informe FIREBASE_API_KEY e FIREBASE_DATABASE_URL.");
  process.exit(1);
}

const authResponse = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  },
);
const authData = await authResponse.json();

if (!authResponse.ok || !authData.idToken) {
  console.error("AUTH_FAIL", authData.error?.message || authResponse.status);
  process.exit(2);
}

const probeCode = "ZZZZZZ";
const readResponse = await fetch(
  `${databaseUrl.replace(/\/$/, "")}/keys/${probeCode}.json?auth=${encodeURIComponent(authData.idToken)}`,
);
const text = await readResponse.text();
if (!readResponse.ok) {
  console.error("RULES_FAIL", readResponse.status, text);
  process.exit(3);
}

console.log("AUTH_OK");
console.log("RULES_READ_OK", text.trim());

// Remove a conta anônima criada apenas para o diagnóstico.
await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(apiKey)}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: authData.idToken }),
  },
).catch(() => undefined);