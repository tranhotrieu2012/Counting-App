class AppSidebar extends HTMLElement {
  constructor() {
    super();
    this.innerHTML = `
      <style>
        @import url('../styles/sidebar.css')
      </style>
      <div class="sidebar" id="sidebar">
        <span class="close-btn" id="close-btn">&times;</span>
        <ul class="menu">
          <li>
            <button type="button" data-target="index">
              <i class="fa-solid fa-house"></i> Home
            </button>
          </li>
          <li>
            <button type="button" data-target="settings">
              <i class="fa-solid fa-cogs"></i> Settings
            </button>
          </li>
          <li>
            <button type="button" data-target="reports">
              <i class="fa-solid fa-file-alt"></i> Reports
            </button>
          </li>
          <li>
            <button type="button" data-target="labels">
              <i class="fa-solid fa-file-alt"></i> Labels
            </button>
          </li>
          <li>
            <button type="button" data-target="logout">
              <i class="fa-solid fa-sign-out-alt"></i> Logout
            </button>
          </li>
        </ul>
      </div>
    `;
  }

  connectedCallback() {
    this.addEventListeners();
  }

  addEventListeners() {
    const sidebar = this.querySelector("#sidebar");
    const closeBtn = this.querySelector("#close-btn");
    const menuButtons = this.querySelectorAll("[data-target]");

    window.addEventListener("openSidebar", () => {
      sidebar.classList.add("open");
    });

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      sidebar.classList.remove("open");
    });

    menuButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = btn.getAttribute("data-target");
        console.log("Sidebar SPA điều hướng tới:", target);
        if (target === "logout") {
          if (confirm("Bạn có chắc chắn muốn đăng xuất?")) {
            // Chỉ gửi sự kiện logout để main process xử lý
            window.api.sendLogout();
          }
        } else {
          window.router.loadPage(target);
        }
        sidebar.classList.remove("open");
      });
    });
  }
}

customElements.define("app-sidebar", AppSidebar);
