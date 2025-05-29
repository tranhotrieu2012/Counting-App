const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  sendLoginSuccess: () => ipcRenderer.send("login-success"),
  sendLogout: () => ipcRenderer.send("logout"),
  checkBackend: () => ipcRenderer.invoke("check-backend"),
  exportAnnotations: (jsonData, imageName) =>
    ipcRenderer.send("export-annotations", jsonData, imageName),
  // Select image folder
  selectImageFolder: () => ipcRenderer.invoke("select-image-folder"),
  readImagesFromFolder: (folderPath) =>
    ipcRenderer.invoke("read-images-from-folder", folderPath),
  copyImagesToDataset: (folderPath) =>
    ipcRenderer.invoke("copy-images-to-dataset", folderPath),
  readAnnotations: (imageName) =>
    ipcRenderer.invoke("read-annotations", imageName),
  // trainModelAll: () => ipcRenderer.send("start-training-all"),
  onTrainingResult: (callback) =>
    ipcRenderer.on("training-result", (event, ...args) => callback(...args)),

  // =================== Train Model ===================
  trainModel: async (params) => {
    try {
      const response = await fetch("http://localhost:5000/api/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Training failed.");
      }

      return await response.json();
    } catch (error) {
      console.error("Train model error:", error.message);
      return { success: false, message: error.message };
    }
  },

  // =================== Check Backend ===================
  checkBackend: async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/check_backend_ready",
        { method: "GET" }
      );
      if (!response.ok) throw new Error("Failed to check backend.");
      return response.json();
    } catch (error) {
      return { message: "Error checking backend.", error: error.message };
    }
  },
  // =================== Connect Camera ===================
  connectCamera: async () => {
    try {
      const response = await fetch("http://localhost:5000/api/connect_camera", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to connect camera");
      return response.json();
    } catch (error) {
      console.error("Error in connectCamera:", error);
      return { message: "Error connecting camera", error: error.message };
    }
  },
  // =================== Trigger ===================
  trigger: async () => {
    try {
      const response = await fetch("http://localhost:5000/api/trigger", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error occurred while triggering");
      }

      return await response.json();
    } catch (error) {
      console.error("Trigger error:", error.message);
      return { success: false, message: error.message };
    }
  },
});
