window.__gerainaInstallSupport = () => {
  const publicPath = /^(\/$|\/(produk|solusi|industri|tentang|sumber-daya)\/?$|\/(geraina|dapuros)(\/(pricing|login|register|activate))?\/?$)/;
  if (location.origin !== 'https://dagangos.com' || !location.pathname.startsWith('/geraina') || document.querySelector('.dagangos-support')) return;

  const surface = location.pathname === "/geraina" || location.pathname.startsWith("/geraina/")
    ? "geraina"
    : location.pathname === "/dapuros" || location.pathname.startsWith("/dapuros/")
      ? "dapuros"
      : "dagangos";
  const surfaces = {
    dagangos: {
      name: "DagangOS",
      subtitle: "Dukungan ekosistem",
      icon: "/assets/brand/dagangos-icon.png",
      launcher: "Tanya DagangOS",
      greeting: "Apa yang bisa saya bantu hari ini?",
      placeholder: "Tanyakan produk atau solusi DagangOS...",
    },
    geraina: {
      name: "Geraina POS",
      subtitle: "Dukungan retail",
      icon: "/assets/brand/geraina-icon.png",
      launcher: "Tanya Geraina",
      greeting: "Apa yang bisa saya bantu tentang Geraina POS hari ini?",
      placeholder: "Tanyakan fitur atau paket Geraina POS...",
    },
    dapuros: {
      name: "DapurOS",
      subtitle: "Dukungan restoran",
      icon: "/assets/brand/dapuros-icon.png",
      launcher: "Tanya DapurOS",
      greeting: "Apa yang bisa saya bantu tentang DapurOS hari ini?",
      placeholder: "Tanyakan fitur atau paket DapurOS...",
    },
  };
  const config = surfaces[surface];

  const host = document.createElement("aside");
  host.className = `dagangos-support dagangos-support--${surface}`;
  host.setAttribute("aria-label", `Dukungan ${config.name}`);
  host.innerHTML = `
    <section class="dagangos-support__panel" aria-label="${config.name} support chat" hidden>
      <header class="dagangos-support__head">
        <div class="dagangos-support__identity">
          <img src="${config.icon}" alt="">
          <div><b>${config.name} Support</b><small>${config.subtitle}</small></div>
        </div>
        <button class="dagangos-support__close" type="button" aria-label="Tutup support chat">&times;</button>
      </header>
      <div class="dagangos-support__messages" aria-live="polite"></div>
      <form class="dagangos-support__form">
        <label for="dagangos-support-message" hidden>Tulis pertanyaan</label>
        <textarea id="dagangos-support-message" rows="1" maxlength="2000" placeholder="${config.placeholder}"></textarea>
        <button class="dagangos-support__send" type="submit" aria-label="Kirim pesan">&uarr;</button>
      </form>
    </section>
    <button class="dagangos-support__launcher" type="button" aria-expanded="false" aria-label="Buka support chat ${config.name}">
      <img src="${config.icon}" alt="">
      <span>${config.launcher}</span><i>Online</i>
    </button>`;

  document.body.appendChild(host);

  const panel = host.querySelector(".dagangos-support__panel");
  const launcher = host.querySelector(".dagangos-support__launcher");
  const close = host.querySelector(".dagangos-support__close");
  const form = host.querySelector(".dagangos-support__form");
  const input = host.querySelector("textarea");
  const send = host.querySelector(".dagangos-support__send");
  const messages = host.querySelector(".dagangos-support__messages");
  const history = [];
  const storageKey = `dagangos_support_conversation_${surface}`;
  const conversationId = sessionStorage.getItem(storageKey)
    || (crypto.randomUUID ? crypto.randomUUID() : `visitor-${Date.now()}`);
  sessionStorage.setItem(storageKey, conversationId);

  const addMessage = (author, text, status = false) => {
    const message = document.createElement("p");
    message.className = `dagangos-support__message dagangos-support__message--${author}${status ? " dagangos-support__message--status" : ""}`;
    const parts = String(text).split(/(https:\/\/dagangos\.com\/[^\s]*)/g);
    parts.forEach((part) => {
      if (/^https:\/\/dagangos\.com\//.test(part)) {
        const link = document.createElement("a");
        link.href = part;
        link.textContent = part.replace("https://dagangos.com", "dagangos.com");
        link.target = "_self";
        message.appendChild(link);
      } else {
        message.appendChild(document.createTextNode(part));
      }
    });
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
    return message;
  };

  addMessage("assistant", config.greeting);

  const setOpen = (open) => {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    launcher.setAttribute("aria-label", open ? "Tutup support chat" : `Buka support chat ${config.name}`);
    if (open) window.setTimeout(() => input.focus(), 40);
  };

  launcher.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));
  window.addEventListener("dagangos:open-support-chat", () => setOpen(true));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) setOpen(false);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || send.disabled) return;

    addMessage("visitor", message);
    history.push({ role: "user", content: message });
    input.value = "";
    send.disabled = true;
    const pending = addMessage("assistant", "Menyiapkan jawaban...", true);

    try {
      const response = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversationId,
          messages: history.slice(-8),
          surface,
          page: location.pathname,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Support chat sedang tidak tersedia.");
      pending.remove();
      const reply = payload.reply || "Informasi tersebut belum tersedia di pusat bantuan produk ini.";
      addMessage("assistant", reply);
      history.push({ role: "assistant", content: reply });
    } catch (error) {
      pending.textContent = error?.message || "Support chat sedang tidak tersedia. Silakan coba kembali.";
    } finally {
      send.disabled = false;
      input.focus();
    }
  });
};