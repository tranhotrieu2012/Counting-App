document.addEventListener("DOMContentLoaded", () => {
  const content = document.getElementById("content");
  // Lưu vào biến toàn cục: đảm bảo dùng window.defaultContent để router có thể truy cập
  window.defaultContent = content.innerHTML;

  // Gắn sự kiện ví dụ cho nút Settings
  const btnSettings = document.getElementById("go-to-settings");
  if (btnSettings) {
    btnSettings.addEventListener("click", (e) => {
      e.preventDefault();
      window.router.loadPage("settings");
    });
  }

  // Xử lý popstate nếu cần
  window.addEventListener("popstate", (event) => {
    if (event.state && event.state.page) {
      window.router.loadPage(event.state.page);
    }
  });
});
