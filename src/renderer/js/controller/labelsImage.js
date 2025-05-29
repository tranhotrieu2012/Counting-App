let canvas = new fabric.Canvas("canvas");
let uploadedImage;
let colorOk = "rgb(17, 240, 17)";
let colorNG = "red";

// =========================== Scale Image ===========================
document
  .getElementById("imageInput")
  .addEventListener("change", function (event) {
    let file = event.target.files[0];
    let reader = new FileReader();
    reader.onload = function (e) {
      fabric.Image.fromURL(e.target.result, function (image) {
        uploadedImage = image;
        canvas.clear();

        // Không thay đổi tỷ lệ ảnh gốc
        let imgWidth = image.width;
        let imgHeight = image.height;

        // Cập nhật kích thước canvas theo ảnh gốc
        canvas.setWidth(imgWidth);
        canvas.setHeight(imgHeight);

        // Thêm ảnh vào canvas mà không thay đổi tỷ lệ
        canvas.add(image);
        canvas.renderAll();
        image.selectable = false; // Không cho di chuyển ảnh
      });
    };
    reader.readAsDataURL(file);
    this.value = "";
  });

// =========================== Add Shape ===========================
let shapeMode = "rect";
function addShape(type) {
  let shape;
  switch (type) {
    case "rect":
      shapeMode = "rect";
      shape = new fabric.Rect({
        left: 50,
        top: 50,
        width: 20,
        height: 20,
        fill: "transparent",
        stroke: "yellow",
        strokeWidth: 2,
        selectable: true,
      });
      break;
    case "circle":
      shapeMode = "circle";
      shape = new fabric.Circle({
        left: 50,
        top: 50,
        radius: 50,
        fill: "transparent",
        stroke: "yellow",
        strokeWidth: 2,
        selectable: true,
        hasControls: true,
      });
      shape.on("scaling", function () {
        shape.set({ scaleY: shape.scaleX });
      });
      break;
    case "triangle":
      shapeMode = "triangle";
      shape = new fabric.Triangle({
        left: 50,
        top: 50,
        width: 50,
        height: 50,
        fill: "transparent",
        stroke: "yellow",
        strokeWidth: 2,
        selectable: true,
      });
      break;
    case "ellipse":
      shape = new fabric.Ellipse({
        left: 50,
        top: 50,
        rx: 80, // Bán kính theo chiều ngang
        ry: 40, // Bán kính theo chiều dọc
        fill: "transparent",
        stroke: "yellow",
        strokeWidth: 2,
        selectable: true,
      });
      break;
    case "roundness": // Vòng tròn xuyến (Circle with hole)
      // Hình tròn ngoài (vòng tròn lớn)
      const outerCircle = new fabric.Circle({
        left: 50,
        top: 50,
        radius: 80, // Bán kính ngoài
        fill: "transparent",
        stroke: `${colorNG}`,
        strokeWidth: 2,
        selectable: true,
      });

      // Hình tròn trong (lỗ bên trong)
      const innerCircle = new fabric.Circle({
        left: 50,
        top: 50,
        radius: 50, // Bán kính nhỏ (lỗ trong)
        fill: "white", // Làm cho phần trong suốt tạo lỗ
        selectable: false, // Không cho phép chỉnh sửa
      });

      // Nhóm hai hình tròn lại với nhau
      const group = new fabric.Group([outerCircle, innerCircle], {
        left: 50,
        top: 50,
        selectable: true,
      });

      // Thêm nhóm vào canvas
      canvas.add(group);

      // Hàm để thay đổi kích thước của cả hai vòng tròn cùng lúc
      group.set({
        scaleX: 1.5,
        scaleY: 1.5,
      });

      // Đảm bảo vòng tròn trong luôn giữ tỷ lệ với vòng tròn ngoài
      innerCircle.set({
        radius: outerCircle.radius * 0.625, // Đảm bảo bán kính trong luôn nhỏ hơn bán kính ngoài theo tỷ lệ
      });

      break;
    default:
      console.error("Không có shape mode hợp lệ.");
      return;
  }

  // Thêm shape vào canvas nếu cần thiết
  if (shape) {
    canvas.add(shape);
  }
}

// =========================== Kiểm tra ảnh và OpenCV ===========================
function checkUploadAndOpenCV() {
  if (!uploadedImage) {
    alert("Chưa có ảnh để cắt!");
    return false;
  }
  if (typeof cv === "undefined" || !cv.imread) {
    alert("OpenCV chưa sẵn sàng!");
    return false;
  }
  return true; // Trả về true nếu mọi thứ OK
}

// =========================== Crop All Drawn Areas ===========================
function cropImages() {
  if (!checkUploadAndOpenCV()) return;

  // Ảnh gốc
  let src = cv.imread(uploadedImage.getElement());
  let croppedImages = [];

  let cropRegions = canvas
    .getObjects()
    .filter((obj) => ["rect", "circle", "polygon"].includes(obj.type));

  if (!cropRegions.length) return alert("Không có vùng nào để cắt!");

  cropRegions.forEach((obj) => {
    let { x, y, width, height } = getCropCoords(obj, src.cols, src.rows);
    let dst = getRotatedCrop(src, x, y, width, height, obj.angle || 0);

    if (obj.type !== "rect") dst = applyShapeMask(dst, shapeMode);

    croppedImages.push(dst);
  });

  src.delete();
  console.log("Cắt xong", croppedImages.length, "ảnh!");
  cropAndDisplayImages(croppedImages);
}


function cropAndDisplayImages(images) {
  let outputContainer = document.getElementById("outputContainer");
  outputContainer.innerHTML = "";
  images.forEach((img) => {
    let canvasOutput = document.createElement("canvas");
    cv.imshow(canvasOutput, img);
    outputContainer.appendChild(canvasOutput);
    img.delete();
  });
  console.log("Cắt & hiển thị xong!");
}

function getCropCoords(obj, maxW, maxH) {
  let corners = obj.getCoords();
  let centerX = corners.reduce((sum, p) => sum + p.x, 0) / 4;
  let centerY = corners.reduce((sum, p) => sum + p.y, 0) / 4;

  // Lấy kích thước gốc của vùng crop
  let width = Math.min(Math.round(obj.getScaledWidth()), maxW);
  let height = Math.min(Math.round(obj.getScaledHeight()), maxH);

  let x = Math.max(0, Math.min(Math.round(centerX - width / 2), maxW - 1));
  let y = Math.max(0, Math.min(Math.round(centerY - height / 2), maxH - 1));

  return { x, y, width, height };
}


function getRotatedCrop(src, x, y, width, height, angle) {
  let center = new cv.Point(x + width / 2, y + height / 2);
  let rotationMatrix = cv.getRotationMatrix2D(center, angle, 1.0);
  let rotated = new cv.Mat();
  cv.warpAffine(src, rotated, rotationMatrix, new cv.Size(src.cols, src.rows));
  let cropped = rotated.roi(new cv.Rect(x, y, width, height));
  rotated.delete();
  return cropped;
}

function applyShapeMask(dst, mode) {
  let mask = new cv.Mat.zeros(dst.rows, dst.cols, cv.CV_8UC4);
  if (mode === "circle")
    cv.circle(
      mask,
      new cv.Point(dst.cols / 2, dst.rows / 2),
      Math.min(dst.rows, dst.cols) / 2,
      [255, 255, 255, 255],
      -1
    );
  else if (mode === "triangle") {
    let pts = cv.matFromArray(3, 1, cv.CV_32SC2, [
      0,
      dst.rows,
      dst.cols / 2,
      0,
      dst.cols,
      dst.rows,
    ]);
    let ptsArray = new cv.MatVector();
    ptsArray.push_back(pts);
    cv.fillPoly(mask, ptsArray, [255, 255, 255, 255]);
    pts.delete();
    ptsArray.delete();
  }
  let result = new cv.Mat();
  dst.copyTo(result, mask);
  dst.delete();
  mask.delete();
  return result;
}

// =========================== Lưu thông số vào file JSON với ID ===========================
function saveCropDataToJSON() {
  if (!checkUploadAndOpenCV()) return;

  let cropRegions = canvas
    .getObjects()
    .filter((obj) => ["rect", "circle", "triangle"].includes(obj.type));

  if (!cropRegions.length) return alert("Không có vùng nào để cắt.");

  let imageId = Date.now();
  let cropData = {
    imageId,
    shape: cropRegions.map((obj, index) => {
      let corners = obj.getCoords();
      let centerX = corners.reduce((sum, c) => sum + c.x, 0) / 4;
      let centerY = corners.reduce((sum, c) => sum + c.y, 0) / 4;

      return {
        shapeId: index + 1,
        shapeMode: obj.type,
        angle: obj.angle || 0,
        cropX: Math.round(centerX - obj.getScaledWidth() / 2), // Bỏ imageScale
        cropY: Math.round(centerY - obj.getScaledHeight() / 2), // Bỏ imageScale
        cropWidth: Math.round(obj.getScaledWidth()), // Giữ nguyên kích thước gốc
        cropHeight: Math.round(obj.getScaledHeight()), // Giữ nguyên kích thước gốc
        result: false,
        score: 60,
      };
    }),
  };

  downloadJSON(JSON.stringify(cropData, null, 2), "cropData.json");
}


function downloadJSON(data, fileName) {
  let link = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([data], { type: "application/json" })),
    download: fileName,
  });
  link.click();
}

// =========================== Clear Canvas ===========================
function clearCanvas() {
  let activeObj = canvas.getActiveObject();
  if (activeObj) {
    canvas.remove(activeObj); // Xóa đối tượng đang chọn
  } else {
    alert("Không có khung vẽ nào được chọn!");
  }
}
// =========================== Clear All Canvas ===========================
function clearAllCanvas() {
  let objectsToRemove = canvas
    .getObjects()
    .filter((obj) => obj.type !== "image");

  if (objectsToRemove.length > 0) {
    objectsToRemove.forEach((obj) => canvas.remove(obj));
    canvas.renderAll();
  } else {
    alert("Không có khung nào để xóa!");
  }
}
// =========================== Save canvas ===========================
// Lưu ảnh đã cắt
function saveCroppedImage() {
  let canvasOutputElement = document.getElementById("canvasOutput");
  let croppedCanvas = canvasOutputElement.getContext("2d");

  // Lấy dữ liệu từ canvasOutput
  let dataUrl = croppedCanvas.canvas.toDataURL("image/png");

  // Tạo liên kết tải xuống
  let link = document.createElement("a");
  link.href = dataUrl;
  link.download = "cropped_image.png"; // Tên file ảnh khi tải về
  link.click();
}
// ================== Vẽ lại các khung cắt từ file JSON ===================
function loadCropDataFromJSON(jsonData) {
  if (!checkUploadAndOpenCV()) return;
  console.log(jsonData);

  jsonData.shape.forEach(
    ({
      shapeMode,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      angle = 0,
      result = false,
      score = 0,
    }) => {
      // Xác định tâm hình dạng
      const centerX = cropX + cropWidth / 2;
      const centerY = cropY + cropHeight / 2;

      // Cấu hình chung cho mọi hình
      const commonProps = {
        left: centerX,
        top: centerY,
        angle,
        originX: "center",
        originY: "center",
        fill: "transparent",
        stroke: result ? `${colorOk}` : `${colorNG}`,
        strokeWidth: 2,
        selectable: false,
      };

      let shape;
      if (shapeMode === "rect") {
        shape = new fabric.Rect({
          ...commonProps,
          width: cropWidth,
          height: cropHeight,
        });
      } else if (shapeMode === "circle") {
        shape = new fabric.Circle({
          ...commonProps,
          radius: cropWidth / 2,
        });
      } else if (shapeMode === "triangle") {
        shape = new fabric.Triangle({
          ...commonProps,
          width: cropWidth,
          height: cropHeight,
        });
      }

      // Thêm shape vào canvas
      canvas.add(shape);

      // **Cách tính mới: scoreText luôn nằm sát cạnh phải trên của hình**
      const scoreTextX = cropX + cropWidth - 5; // Gần mép phải
      const scoreTextY = cropY - 18; // Gần mép trên

      // Chuyển đổi góc sang radian
      const angleRad = (angle * Math.PI) / 180;

      // Tính vị trí sau khi xoay
      const rotatedX =
        centerX +
        (scoreTextX - centerX) * Math.cos(angleRad) -
        (scoreTextY - centerY) * Math.sin(angleRad);
      const rotatedY =
        centerY +
        (scoreTextX - centerX) * Math.sin(angleRad) +
        (scoreTextY - centerY) * Math.cos(angleRad);

      // Tạo scoreText
      const scoreText = new fabric.Text(`${score}`, {
        left: rotatedX,
        top: rotatedY,
        fontSize: 16,
        fill: result ? `${colorOk}` : `${colorNG}`,
        originX: "right",
        originY: "top",
        selectable: false,
      });

      // Xoay text theo hình
      scoreText.set({ angle });

      // Thêm text vào canvas
      canvas.add(scoreText);
    }
  );
}



// Hàm tải file JSON và vẽ lại các vùng cắt
function loadAndDrawCroppedRegions(fileInput) {
  const reader = new FileReader();

  reader.onload = function (event) {
    try {
      const jsonData = JSON.parse(event.target.result); // Đọc và phân tích dữ liệu JSON từ file
      // Kiểm tra xem jsonData có chứa trường "shape" không
      if (jsonData && jsonData.shape && Array.isArray(jsonData.shape)) {
        // Chỉ xóa các vùng cắt cũ, giữ lại ảnh nền
        canvas.getObjects().forEach((obj) => {
          if (obj.type !== "image") {
            canvas.remove(obj);
          }
        });
        loadCropDataFromJSON(jsonData); // Vẽ lại các vùng cắt
      } else {
        console.error("Dữ liệu JSON không hợp lệ.");
      }
    } catch (error) {
      console.error("Lỗi khi phân tích dữ liệu JSON:", error);
    }
    // Reset input file sau khi xử lý xong
    fileInput.value = "";
  };

  reader.readAsText(fileInput.files[0]); // Đọc file đầu tiên mà người dùng đã chọn
}
