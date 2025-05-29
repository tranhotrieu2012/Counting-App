// Hàm loadScript: tạo và nạp một thẻ script mới vào <head>
function loadScript(url, callback) {
  // Kiểm tra xem script đã tồn tại chưa
  const oldScript = document.querySelector(`script[src="${url}"]`);
  if (oldScript) {
    oldScript.remove(); // Xóa script cũ
  }

  // Tạo và nạp script mới
  const script = document.createElement("script");
  script.src = url + "?v=" + new Date().getTime(); // Thêm timestamp để tránh cache
  script.type = "module";
  script.onload = () => {
    if (callback) callback();
  };
  document.head.appendChild(script);
}

// Hàm loadPage: load nội dung trang con và nạp file JS động nếu cần
// function loadPage(pageName) {
//   const content = document.getElementById("content");

//   if (pageName === "index") {
//     // Sử dụng window.defaultContent đã lưu từ renderer.js
//     if (window.defaultContent) {
//       content.innerHTML = window.defaultContent;
//       window.history.pushState({ page: pageName }, "", `#${pageName}`);
//     } else {
//       console.error("defaultContent chưa được lưu!");
//     }
//     return;
//   }

//   // Đối với các trang khác, dùng fetch để load file HTML tương ứng
//   fetch(`../pages/${pageName}.html`)
//     .then((res) => {
//       if (!res.ok) throw new Error("Page not found: " + pageName);
//       return res.text();
//     })
//     .then((html) => {
//       content.innerHTML = html;
//       window.history.pushState({ page: pageName }, "", `#${pageName}`);

//       // Nếu có nút "go-to-home" trong trang vừa load, gắn sự kiện click
//       const btnHome = document.getElementById("go-to-home");
//       if (btnHome) {
//         btnHome.addEventListener("click", (e) => {
//           e.preventDefault();
//           loadPage("index");
//         });
//       }

//       // Nếu trang được load là "labels", nạp file labels.js động
//       if (pageName === "labels") {
//         loadScript("../js/controller/labels.js", () => {
//           console.log("labels.js đã được tải");
//         });
//       }
//     })
//     .catch((error) => {
//       console.error("Error loading page:", error);
//     });
// }
function loadPage(pageName) {
  const content = document.getElementById("content");

  if (pageName === "index") {
    if (window.defaultContent) {
      content.innerHTML = window.defaultContent;
      window.history.pushState({ page: pageName }, "", `#${pageName}`);

      // Luôn nạp lại index.js khi quay lại index
      loadScript("../js/controller/index.js");
    } else {
      console.error("defaultContent chưa được lưu!");
    }
    return;
  }

  fetch(`../pages/${pageName}.html`)
    .then((res) => {
      if (!res.ok) throw new Error("Page not found: " + pageName);
      return res.text();
    })
    .then((html) => {
      const range = document.createRange();
      const fragment = range.createContextualFragment(html);
      content.innerHTML = "";
      content.appendChild(fragment);

      window.history.pushState({ page: pageName }, "", `#${pageName}`);

      // Gắn lại sự kiện nút Home
      const btnHome = document.getElementById("go-to-home");
      if (btnHome) {
        btnHome.addEventListener("click", (e) => {
          e.preventDefault();
          loadPage("index");
        });
      }

      // Nếu trang là "labels", nạp labels.js
      if (pageName === "labels") {
        loadScript("../js/controller/labels.js");
      }
    })
    .catch((error) => {
      console.error("Error loading page:", error);
    });
}


// Đưa hàm loadPage vào đối tượng router toàn cục
window.router = { loadPage };
