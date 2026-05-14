// Tiny renderer for the content.json driven landing page.
// Reads content.json from the same directory, fills in the headline / subhead / CTA,
// posts the signup to /api/signup (deploy phase wires this to a count store).

async function load() {
  const res = await fetch("./content.json", { cache: "no-store" });
  if (!res.ok) {
    document.querySelector("#root").innerHTML = "<p>content.json missing</p>";
    return;
  }
  return res.json();
}

function render(content) {
  const root = document.querySelector("#root");
  root.innerHTML = `
    <h1></h1>
    <p class="subhead"></p>
    <form id="signup">
      <input type="email" name="email" placeholder="your@email" required autocomplete="email" />
      <button type="submit"></button>
    </form>
    <p class="attr"></p>
  `;
  root.querySelector("h1").textContent = content.headline;
  root.querySelector(".subhead").textContent = content.subhead;
  root.querySelector("button").textContent = content.cta;
  root.querySelector(".attr").textContent = content.attribution || "";

  const form = root.querySelector("#signup");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    const email = new FormData(form).get("email");
    try {
      await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          cluster: content.cluster_id,
          referrer: document.referrer || null,
          utm: location.search || null,
        }),
      }).catch(() => undefined);
      root.innerHTML = `<p class="thank">Thanks. We'll email when it's ready.</p>`;
    } catch {
      button.disabled = false;
    }
  });
}

load().then((c) => { if (c) render(c); });
