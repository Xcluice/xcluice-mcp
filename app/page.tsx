export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 600 }}>
      <h1>Xcluice MCP Server</h1>
      <p>
        This is a private Model Context Protocol server for the Xcluice
        workspace. It is not a public API — the MCP endpoint requires a
        secret path segment to authenticate.
      </p>
    </main>
  );
}
