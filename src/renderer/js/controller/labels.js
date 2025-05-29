// --- Các biến toàn cục ---
let imageFiles = []; // Mảng chứa File objects từ folder
let currentImageIndex = 0;
let imageObj = null; // Đối tượng Image hiện đang hiển thị
let annotations = []; // Mảng lưu annotation dạng bounding box
window.currentScaleFactor = 1; // Scale factor hiện tại (mặc định = 1)

// --- Lấy tham chiếu các phần tử DOM ---
const folderInput = document.getElementById("folderInput");
const thumbnailContainer = document.querySelector(".thumbnail-view");
const imageArea = document.querySelector(".image-area");
const folderBtn = document.getElementById("folderBtn");
const folderPathDisplay = document.getElementById("folderPathDisplay");

// Các tham số cấu hình từ sidebar
const thicknessInput = document.getElementById("thicknessInput");
const thresholdInput = document.getElementById("thresholdInput");
const autoLabelCheckbox = document.getElementById("autoLabelCheckbox");
const showBoxCheckbox = document.getElementById("showBoxCheckbox");
const showPolylinesCheckbox = document.getElementById("showPolylinesCheckbox");

// --- Cấu hình ban đầu ---
const config = {
  thickness: parseInt(thicknessInput.value),
  threshold: parseFloat(thresholdInput.value),
  autoLabel: autoLabelCheckbox.checked,
  showBox: showBoxCheckbox.checked,
  showPolylines: showPolylinesCheckbox.checked,
  // Các tham số khác có thể thêm vào sau
};

// --- Cập nhật cấu hình khi giá trị thay đổi ---
thicknessInput.addEventListener("change", (e) => {
  config.thickness = parseInt(e.target.value);
});
thresholdInput.addEventListener("change", (e) => {
  config.threshold = parseFloat(e.target.value);
});
autoLabelCheckbox.addEventListener("change", (e) => {
  config.autoLabel = e.target.checked;
});
showBoxCheckbox.addEventListener("change", (e) => {
  config.showBox = e.target.checked;
  drawAllAnnotations();
});
showPolylinesCheckbox.addEventListener("change", (e) => {
  config.showPolylines = e.target.checked;
  drawAllAnnotations();
});

// --- Khởi tạo canvas ---
let canvas = document.createElement("canvas");
canvas.id = "canvas";
// Kích thước tạm thời, sẽ được điều chỉnh khi load ảnh
canvas.width = 800;
canvas.height = 600;
imageArea.innerHTML = "";
imageArea.appendChild(canvas);
const ctx = canvas.getContext("2d");

// --- Biến toàn cục khác ---
let selectedFolderPath = null;

// --- Hàm tạo thumbnail cho ảnh ---
function createThumbnails() {
  thumbnailContainer.innerHTML = ""; // Xoá nội dung cũ
  imageFiles.forEach((filePath, index) => {
    const thumb = document.createElement("img");
    thumb.src = `file://${filePath}`; // Sử dụng giao thức file:// để hiển thị ảnh từ đường dẫn hệ thống
    thumb.alt = filePath.split(/[/\\]/).pop();
    thumb.classList.add("thumbnail");
    thumb.style.width = "100px";
    thumb.style.height = "auto";
    thumb.style.margin = "5px";
    thumb.addEventListener("click", () => {
      // Nếu có annotation của ảnh hiện tại, lưu file label tự động trước khi chuyển ảnh
      if (annotations.length > 0) {
        autoExportAnnotations();
      }
      currentImageIndex = index;
      loadImageFile(filePath);
    });
    thumbnailContainer.appendChild(thumb);
  });
}

// --- Hàm load ảnh và hiển thị trên canvas ---
function loadImageFile(filePath) {
  const img = new Image();
  img.onload = async () => {
    imageObj = img; // Cập nhật imageObj toàn cục

    // Tính toán scale factor để ảnh vừa với container
    const containerWidth = imageArea.clientWidth;
    const containerHeight = imageArea.clientHeight;
    const scaleFactor = Math.min(
      containerWidth / img.width,
      containerHeight / img.height,
      1
    );
    window.currentScaleFactor = scaleFactor;
    canvas.width = img.width * scaleFactor;
    canvas.height = img.height * scaleFactor;

    // Vẽ ảnh nền lên canvas
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Lấy tên file từ đường dẫn
    const imageName = filePath.split(/[/\\]/).pop();

    // Đọc annotation từ file (giả sử API readAnnotations nhận tên file)
    const storedData = await window.api.readAnnotations(imageName);
    if (storedData) {
      annotations = storedData
        .split("\n")
        .map((line) => {
          const parts = line.split(" ");
          if (parts.length < 5) return null; // Bỏ qua dòng không hợp lệ
          const [label, x, y, width, height] = parts.map(Number);
          return {
            // Quy đổi tọa độ từ file gốc sang tọa độ trên canvas
            x: (x - width / 2) * canvas.width,
            y: (y - height / 2) * canvas.height,
            width: width * canvas.width,
            height: height * canvas.height,
            label,
          };
        })
        .filter((ann) => ann !== null);
    } else {
      annotations = [];
    }
    drawAllAnnotations();
  };
  // Gán src cho image bằng đường dẫn tuyệt đối với giao thức file://
  img.src = `file://${filePath}`;
}
// Đường dẫn toàn cục
let updateResult;
// --- Hàm tự động export annotation ---
function autoExportAnnotations() {
  if (annotations.length === 0) return;

  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // Lấy danh sách class từ localStorage (nếu có)
  let storedClasses = JSON.parse(localStorage.getItem("classList")) || [];

  // Cập nhật danh sách class nếu có nhãn mới
  annotations.forEach((ann) => {
    if (!storedClasses.includes(ann.label)) {
      storedClasses.push(ann.label);
    }
  });
  localStorage.setItem("classList", JSON.stringify(storedClasses));

  // Chuyển đổi annotations theo định dạng YOLOv8
  const yoloAnnotations = annotations.map((ann) => {
    const x_center = ((ann.x + ann.width / 2) / imgWidth).toFixed(6);
    const y_center = ((ann.y + ann.height / 2) / imgHeight).toFixed(6);
    const width = (ann.width / imgWidth).toFixed(6);
    const height = (ann.height / imgHeight).toFixed(6);
    // const classId = storedClasses.indexOf(ann.label);
    const classId = 0;
    return `${classId} ${x_center} ${y_center} ${width} ${height}`;
  });
  const yoloText = yoloAnnotations.join("\n");

  // Lấy tên file từ đường dẫn hiện tại
  const imagePath = imageFiles[currentImageIndex] || "";
  const imageName = imagePath.split(/[/\\]/).pop() || "unknown";

  // Gửi dữ liệu qua IPC để lưu file txt theo định dạng YOLOv8
  if (window.api.exportAnnotations) {
    window.api.exportAnnotations(yoloText, imageName);
  } else {
    console.log("Annotations data:", yoloText);
  }
}

// --- Xử lý chọn thư mục chứa ảnh ---
folderBtn.addEventListener("click", async () => {
  const folderPath = await window.api.selectImageFolder();
  if (folderPath) {
    selectedFolderPath = folderPath;
    folderPathDisplay.textContent = folderPath;

    // // Gán cho đường dẫn toàn cục
    // updateResult = folderPath;
    // Lấy danh sách file ảnh từ folder đã chọn
    imageFiles = await window.api.readImagesFromFolder(folderPath);

    if (imageFiles.length) {
      currentImageIndex = 0;
      createThumbnails();
      loadImageFile(imageFiles[currentImageIndex]);

      // Gọi API để copy ảnh vào dataset
      await window.api.copyImagesToDataset(folderPath);
    }
  } else {
    console.log("Không có folder nào được chọn.");
  }
});

// --- Xử lý sự kiện vẽ annotation ---
let drawing = false;
let startX = 0,
  startY = 0;
let scale = 1; // Tỉ lệ zoom (1 = 100%)
let offsetX = 0,
  offsetY = 0; // Dịch chuyển ảnh
let isPanning = false;
let startPanX = 0,
  startPanY = 0;

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left - offsetX) / scale;
  const mouseY = (e.clientY - rect.top - offsetY) / scale;

  if (e.button === 2) {
    // Chuột phải để pan
    isPanning = true;
    startPanX = e.clientX - offsetX;
    startPanY = e.clientY - offsetY;
  } else {
    startX = mouseX;
    startY = mouseY;
    drawing = true;
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (isPanning) {
    offsetX = e.clientX - startPanX;
    offsetY = e.clientY - startPanY;
    drawAllAnnotations();
  } else if (drawing) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - offsetX) / scale;
    const mouseY = (e.clientY - rect.top - offsetY) / scale;

    drawAllAnnotations();
    // ctx.lineWidth = config.thickness / scale;
    ctx.lineWidth = (config.thickness / scale) * 0.5;

    ctx.strokeStyle = "blue";
    ctx.strokeRect(startX, startY, mouseX - startX, mouseY - startY);
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (drawing) {
    drawing = false;
    const rect = canvas.getBoundingClientRect();
    const endX = (e.clientX - rect.left - offsetX) / scale;
    const endY = (e.clientY - rect.top - offsetY) / scale;

    annotations.push({
      x: startX,
      y: startY,
      width: endX - startX,
      height: endY - startY,
      label: config.autoLabel ? 0 : 1,
    });
    drawAllAnnotations();
  }
  isPanning = false;
});

canvas.addEventListener("dblclick", (e) => {
  const rect = canvas.getBoundingClientRect();
  const clickX = (e.clientX - rect.left - offsetX) / scale;
  const clickY = (e.clientY - rect.top - offsetY) / scale;

  for (let i = 0; i < annotations.length; i++) {
    const ann = annotations[i];
    if (
      clickX >= ann.x &&
      clickX <= ann.x + ann.width &&
      clickY >= ann.y &&
      clickY <= ann.y + ann.height
    ) {
      annotations.splice(i, 1);
      break;
    }
  }
  drawAllAnnotations();
});

function drawAllAnnotations() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  if (imageObj) {
    ctx.drawImage(imageObj, 0, 0, canvas.width, canvas.height);
  }

  annotations.forEach((ann) => {
    if (config.showBox) {
      ctx.lineWidth = (config.thickness / scale) * 0.5;
      // ctx.lineWidth = config.thickness / scale;q
      ctx.strokeStyle = "red";
      ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
    }
  });

  ctx.restore();
}

canvas.addEventListener("wheel", (e) => {
  const zoomFactor = 1.1;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const dx = (mouseX - offsetX) / scale;
  const dy = (mouseY - offsetY) / scale;

  scale *= e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
  scale = Math.max(0.5, Math.min(scale, 5));

  offsetX = mouseX - dx * scale;
  offsetY = mouseY - dy * scale;
  drawAllAnnotations();
});

window.addEventListener("keydown", (e) => {
  const panSpeed = 10 / scale;
  if (e.key === "w") offsetY += panSpeed;
  if (e.key === "s") offsetY -= panSpeed;
  if (e.key === "a") offsetX += panSpeed;
  if (e.key === "d") offsetX -= panSpeed;
  drawAllAnnotations();
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// --- Gửi thông số train và cập nhật giao diện ---
const updateUI = (status, progress) => {
  document.getElementById("trainingStatus").innerText = status;
  document.getElementById("progressBar").style.width = progress;
};

// ========================================================================

document.getElementById("startTraining").addEventListener("click", async () => {
  // await window.api.updateDataset(updateResult);
  const params = {
    dataset_path: "./dataset/data.yaml",
    thickness: thicknessInput.value,
    threshold: thresholdInput.value,
    epochs: document.getElementById("epochsInput").value,
    imgsz: document.getElementById("imgszInput").value,
    batch: document.getElementById("batchSizeInput").value,
    workers: document.getElementById("workersInput").value,
  };

  updateUI("Training...", "20%");
  const response = await window.api.trainModel(params);

  if (response.error) {
    updateUI("Error!", "20%");
    console.error(response.error);
  } else {
    updateUI("Completed!", "100%");
  }
});
