const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const yaml = require("js-yaml");

let mainWindow;
let loginWindow;

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 600,
    height: 700,
    resizable: false,
    frame: true, // Hoặc false nếu bạn muốn giao diện tùy chỉnh
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  loginWindow.loadFile(path.join(__dirname, "../renderer/pages/login.html"));
  loginWindow.on("closed", () => (loginWindow = null));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.maximize();
  mainWindow.loadFile(path.join(__dirname, "../renderer/pages/index.html"));
  mainWindow.on("closed", () => (mainWindow = null));
}

// Khởi tạo cửa sổ đăng nhập đầu tiên
app.whenReady().then(createLoginWindow);
// ================================ COPY ẢNH ================================
ipcMain.handle("copy-images-to-dataset", async (event, sourceFolder) => {
  try {
    const datasetPath = path.join(__dirname, "../../backend/dataset");

    const trainFolder = path.join(datasetPath, "train/images");
    const validFolder = path.join(datasetPath, "val/images");
    const testFolder = path.join(datasetPath, "test/images");

    // Hàm xóa toàn bộ ảnh cũ trước khi copy ảnh mới
    function clearFolder(folderPath) {
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true }); // Xóa toàn bộ thư mục
      }
      fs.mkdirSync(folderPath, { recursive: true }); // Tạo lại thư mục rỗng
    }

    // Xóa ảnh cũ
    [trainFolder, validFolder, testFolder].forEach(clearFolder);

    // Lấy danh sách file ảnh hợp lệ
    const imageFiles = fs
      .readdirSync(sourceFolder)
      .filter((file) =>
        [".jpg", ".jpeg", ".png", ".bmp"].includes(path.extname(file).toLowerCase())
      );

    if (imageFiles.length === 0) {
      console.log("❌ Không tìm thấy ảnh hợp lệ!");
      return { success: false, message: "Không có ảnh hợp lệ!" };
    }


    // Xáo trộn danh sách ảnh để phân bố ngẫu nhiên
    imageFiles.sort(() => Math.random() - 0.5);

    // Chia ảnh theo tỉ lệ 70-20-10
    const trainSize = Math.round(imageFiles.length * 0.7);
    const validSize = Math.round(imageFiles.length * 0.2);

    imageFiles.forEach((file, index) => {
      let targetFolder;
      if (index < trainSize) targetFolder = trainFolder;
      else if (index < trainSize + validSize) targetFolder = validFolder;
      else targetFolder = testFolder;

      const srcPath = path.join(sourceFolder, file);
      const destPath = path.join(targetFolder, file);

      fs.copyFileSync(srcPath, destPath);
      
    });

    return { success: true, message: "Đã xóa ảnh cũ và copy ảnh mới thành công!" };
  } catch (error) {
    console.error("❌ Lỗi khi copy ảnh:", error);
    return { success: false, message: error.message };
  }
});


// ================================ FILE TXT ================================
ipcMain.on("export-annotations", (event, yoloText, imagePath) => {
  // Kiểm tra imagePath
  if (!imagePath || typeof imagePath !== "string") {
    console.error("❌ imagePath không hợp lệ:", imagePath);
    event.reply("export-result", "error: imagePath không hợp lệ");
    return;
  }

  // Tạo đường dẫn cho thư mục train và val
  const datasetDir = path.join(__dirname, "..", "..", "backend", "dataset");
  const trainLabelsDir = path.join(datasetDir, "train", "labels");
  const valLabelsDir = path.join(datasetDir, "val", "labels");

  // Đảm bảo cả hai thư mục tồn tại
  [trainLabelsDir, valLabelsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const baseName = path.basename(imagePath, path.extname(imagePath));
  const trainFilePath = path.join(trainLabelsDir, baseName + ".txt");
  const valFilePath = path.join(valLabelsDir, baseName + ".txt");

  // Hàm ghi file vào cả train và val
  function writeFileAndReply(filePath) {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, yoloText, (err) => {
        if (err) {
          console.error(`❌ Lỗi khi lưu file: ${filePath}`, err);
          reject(err);
        } else {
          // console.log(`✅ File labels đã lưu: ${filePath}`);
          resolve();
        }
      });
    });
  }

  // Ghi file vào cả hai thư mục train và val
  Promise.all([
    writeFileAndReply(trainFilePath),
    writeFileAndReply(valFilePath),
  ])
    .then(() => {
      event.reply("export-result", "success");
    })
    .catch(() => {
      event.reply("export-result", "error");
    });
});

// Xử lý đọc annotation YOLOv8
ipcMain.handle("read-annotations", async (event, imageName) => {
  const baseName = path.parse(imageName).name;

  const labelsDir = path.join(
    __dirname,
    "..",
    "..",
    "backend",
    "dataset",
    "train",
    "labels"
  );
  const filePath = path.join(labelsDir, `${baseName}.txt`);

  try {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf8");
      return fileContent;
    } else {
      return null;
    }
  } catch (err) {
    console.error("Error reading annotations file:", err);
    return null;
  }
});
// Gửi đường dẫn của folder hình ảnh
ipcMain.handle("select-image-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (!result.canceled && result.filePaths && result.filePaths[0]) {
    return result.filePaths[0];
  }
  return null;
});
// Handler đọc danh sách file ảnh từ folder
ipcMain.handle("read-images-from-folder", async (event, folderPath) => {
  try {
    const files = fs.readdirSync(folderPath);
    // Lọc ra các file có định dạng hình ảnh
    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return [".png", ".jpg", ".jpeg", ".gif", ".bmp"].includes(ext);
    });
    // Chuyển đổi thành đường dẫn tuyệt đối cho từng file
    const absolutePaths = imageFiles.map((file) => path.join(folderPath, file));
    return absolutePaths;
  } catch (error) {
    console.error("Error reading folder:", error);
    return [];
  }
});

// IPC: Sau khi login thành công, đóng cửa sổ login và mở cửa sổ chính
ipcMain.on("login-success", () => {
  if (loginWindow) {
    loginWindow.close();
  }
  createMainWindow();
});

// IPC: Lắng nghe sự kiện "logout" từ renderer
ipcMain.on("logout", () => {
  if (mainWindow) {
    mainWindow.close();
  }
  createLoginWindow();
});

// Đóng app khi tất cả cửa sổ đã đóng (trừ macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
