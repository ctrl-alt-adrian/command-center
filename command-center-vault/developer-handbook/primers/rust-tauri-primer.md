# Rust + Tauri Primer (general reference)

> ## ⚠️ This page does NOT describe Command Center
>
> **This project contains NO Rust and NO Tauri.** Command Center is a
> **SvelteKit + Node web app** (TypeScript backend, `adapter-node`, port 3001 —
> see [../dashboard/01-stack-and-bootstrap.md](../dashboard/01-stack-and-bootstrap.md)).
>
> This page is a **standalone general-reference primer**, included at the
> author's request for **future** projects. Nothing below points at a file in
> this repo, because none of it exists here. If you're looking for how *this*
> codebase works, you want the [TypeScript + Node primer](./typescript-node-primer.md),
> the [SvelteKit primer](./sveltekit-primer.md), and the
> [Svelte 5 primer](./svelte-5-primer.md).

With that firmly established — here is a concise but correct primer on Rust and
Tauri.

Official docs (read these; this is a map):
- The Rust Book — <https://doc.rust-lang.org/book/>
- Rust std library — <https://doc.rust-lang.org/std/>
- Tauri v2 — <https://v2.tauri.app/>

---

## Part 1: Rust basics

Rust is a systems language with memory safety **without a garbage collector**,
enforced at compile time by the borrow checker.

### Cargo (the toolchain)

`cargo` is Rust's build tool + package manager. Packages are "crates";
dependencies live in `Cargo.toml`.

```bash
cargo new my_app        # scaffold a binary crate
cargo build             # compile (debug)
cargo build --release   # optimized build
cargo run               # build + run
cargo test              # run tests
cargo add tokio         # add a dependency to Cargo.toml
```

```toml
# Cargo.toml
[package]
name = "my_app"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
```

### Ownership & borrowing (the core idea)

Every value has a single **owner**. When the owner goes out of scope, the value
is dropped (freed). You can **borrow** a value with references instead of moving
ownership:

```rust
fn main() {
    let s = String::from("hello");   // s owns the String
    let len = length(&s);            // borrow: pass a shared reference
    println!("{s} is {len} chars");  // s still valid — it was only borrowed
}

fn length(text: &str) -> usize {     // &str: a borrowed string slice
    text.len()
}
```

Rules the compiler enforces:

- **One owner at a time.** Assigning/passing by value *moves* ownership; the old
  binding becomes invalid (no accidental double-free).
- **Either many shared `&` borrows OR exactly one mutable `&mut` borrow** at a
  time — never both. This eliminates data races at compile time.
- **No reference outlives its data** (the "lifetime" rule).

This is why Rust has no GC and no null: errors that would be runtime crashes in
other languages are compile errors here.

### Structs, enums, traits

```rust
struct Task {                    // a record type
    id: String,
    retries: u32,
}

enum Status {                    // a sum type (one of these variants)
    Pending,
    Running,
    Failed(String),              // a variant can carry data
}

trait Describe {                 // like an interface
    fn describe(&self) -> String;
}

impl Describe for Task {         // implement the trait for Task
    fn describe(&self) -> String {
        format!("task {} ({} retries)", self.id, self.retries)
    }
}
```

`match` is exhaustive pattern matching over enums — the compiler makes you handle
every variant:

```rust
fn label(s: &Status) -> &str {
    match s {
        Status::Pending => "pending",
        Status::Running => "running",
        Status::Failed(reason) => reason,   // bind the carried data
    }
}
```

### `Result` and `Option` (errors and absence, no exceptions/null)

Rust has no exceptions and no `null`. Fallible operations return
**`Result<T, E>`** (`Ok(value)` or `Err(error)`); maybe-absent values are
**`Option<T>`** (`Some(value)` or `None`).

```rust
use std::fs;

fn read_count(path: &str) -> Result<usize, std::io::Error> {
    let text = fs::read_to_string(path)?;   // `?` propagates the Err early
    Ok(text.lines().count())                // explicit Ok wrap on success
}

fn first_word(s: &str) -> Option<&str> {
    s.split_whitespace().next()             // Some(word) or None
}
```

The **`?` operator** is the workhorse: on `Ok`/`Some` it unwraps the value; on
`Err`/`None` it returns early from the function. It's the idiomatic alternative
to nested `match`.

### Async with Tokio

Rust's `async`/`await` needs a runtime; **Tokio** is the standard choice.

```rust
use tokio::time::{sleep, Duration};

#[tokio::main]                          // sets up the runtime
async fn main() {
    let a = fetch("https://example.com/a");
    let b = fetch("https://example.com/b");
    let (ra, rb) = tokio::join!(a, b);  // run both concurrently
    println!("{ra:?} {rb:?}");
}

async fn fetch(url: &str) -> Result<String, reqwest::Error> {
    sleep(Duration::from_millis(10)).await;
    reqwest::get(url).await?.text().await
}
```

`async fn` returns a `Future` that does nothing until `.await`ed (or driven by
the runtime). `tokio::join!`/`tokio::spawn` give concurrency.

---

## Part 2: Tauri basics

**Tauri** builds cross-platform **desktop apps** with a **Rust backend** and a
**web frontend** (any framework — React, Svelte, vanilla). Unlike Electron, it
uses the OS's native webview instead of bundling Chromium, so binaries are small
and memory-light. ([Tauri v2](https://v2.tauri.app/))

### Shape of a Tauri app

```
my-app/
├── src/                 # web frontend (your Svelte/React app)
├── src-tauri/
│   ├── src/main.rs      # Rust backend entry point
│   ├── Cargo.toml       # Rust deps
│   └── tauri.conf.json  # app config (window, bundle, security)
└── package.json
```

### `tauri.conf.json`

The app manifest — window size, identifier, build commands, bundle targets, and
the security allowlist:

```jsonc
{
  "productName": "My App",
  "identifier": "com.example.myapp",
  "build": {
    "frontendDist": "../build",        // where the built web frontend lives
    "devUrl": "http://localhost:3001", // dev server (e.g. SvelteKit on 3001)
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [{ "title": "My App", "width": 1200, "height": 800 }]
  }
}
```

### Commands: `#[tauri::command]`

A **command** is a Rust function the frontend can call. Annotate it, register it,
and Tauri exposes it over the IPC bridge:

```rust
// src-tauri/src/main.rs
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}!")
}

#[tauri::command]
async fn run_processor() -> Result<String, String> {
    // async commands are supported; map errors to a String the JS side gets
    do_work().await.map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, run_processor])
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
```

A command returning `Result<T, E>` surfaces `Err` as a rejected promise on the
JS side; `Ok` resolves it.

### The `invoke()` bridge (frontend → Rust)

The frontend calls a command with `invoke()`. From a **Svelte** component it
looks like any async call:

```svelte
<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";

  let name = $state("world");
  let greeting = $state("");

  async function greet() {
    // calls the Rust #[tauri::command] named "greet"
    greeting = await invoke<string>("greet", { name });
  }
</script>

<input bind:value={name} />
<button onclick={greet}>greet</button>
<p>{greeting}</p>
```

The second arg to `invoke` is an object whose keys match the command's
parameters. Tauri serializes across the IPC boundary (via `serde`), so use
JSON-friendly types.

---

## If Command Center ever migrated to Tauri

This is hypothetical — there is no plan and no code. But the architecture would
map cleanly:

- **The SvelteKit frontend could largely stay.** Components, runes, and the
  `/tasks`, `/vault`, `/marketing` UI are just a web app the native webview can
  host. The build would target a static/`devUrl` frontend that Tauri loads.
- **The Node backend logic would move into Rust commands.** Today's `core/lib/*`
  and `pipelines/*` (task store, processor, vault reader, the `claude` wrapper)
  would become `#[tauri::command]` functions, and the dashboard's
  `fetch("/api/...")` calls would become `invoke("...")` calls. The file-based
  task store, `execFile`-spawned CLIs, and fs scans all have direct Rust
  equivalents (`std::fs`, `std::process::Command`, `tokio`).

The takeaway: the *frontend stays, the backend ports*. But again — **today this
is a SvelteKit + Node web app with no Rust anywhere.**

---

## Quick reference

| Concept | Rust |
|---|---|
| Build/package tool | `cargo` (`Cargo.toml`, crates) |
| Memory safety | ownership + borrowing, checked at compile time |
| Errors | `Result<T, E>` + `?` operator (no exceptions) |
| Absence | `Option<T>` (`Some`/`None`, no null) |
| Types | `struct`, `enum` (sum types), `trait` (interfaces) |
| Pattern match | exhaustive `match` |
| Async | `async`/`await` + a runtime (Tokio) |

| Concept | Tauri |
|---|---|
| What it is | Rust backend + web frontend desktop apps (native webview) |
| Config | `tauri.conf.json` |
| Backend fn | `#[tauri::command]`, registered in `generate_handler!` |
| Frontend → Rust | `invoke("command", { args })` from `@tauri-apps/api` |

- The Rust Book — <https://doc.rust-lang.org/book/>
- std — <https://doc.rust-lang.org/std/>
- Tauri v2 — <https://v2.tauri.app/>

---

## See also (the actual stack)

- [../dashboard/01-stack-and-bootstrap.md](../dashboard/01-stack-and-bootstrap.md) — what this project really runs on.
- [typescript-node-primer.md](./typescript-node-primer.md) — the real backend language.
- [sveltekit-primer.md](./sveltekit-primer.md) · [svelte-5-primer.md](./svelte-5-primer.md)
