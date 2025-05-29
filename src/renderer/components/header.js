class Header extends HTMLElement {
  constructor() {
    super();
    this.innerHTML = `
      <style>
        @import url('../styles/header.css');
      </style>
      <header class="header">
        <div class="logo">
          <img id="logo-img" src="../assets/logo.png" alt="Logo">
        </div>
        <h1 class="title">Electron SPA App</h1>
        <nav class="nav">
          <button type="button" id="lang-btn" class="header-btn">
            <i class="fa-solid fa-language"></i>
            <span>Language</span>
          </button>
          <button type="button" id="help-btn" class="header-btn">
            <i class="fa-solid fa-circle-question"></i>
            <span>Help</span>
          </button>
          <button type="button" id="open-sidebar-btn" class="header-btn">
            <i class="fa-solid fa-bars"></i>
            <span>Menu</span>
          </button>
        </nav>
      </header>
    `;
  }

  connectedCallback() {
    this.attachEventListeners();
  }

  attachEventListeners() {
    const openSidebarBtn = this.querySelector("#open-sidebar-btn");
    openSidebarBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new Event("openSidebar"));
    });
  }

  set logo(src) {
    const logoImg = this.querySelector("#logo-img");
    if (logoImg) {
      logoImg.src = src;
    }
  }
}

customElements.define("app-header", Header);
