// Khai báo
const loading = document.getElementById("loading");
const btnTrigger = document.getElementById("camera-trigger");
const processedImage = document.getElementById("processed-image");

document.addEventListener("DOMContentLoaded", async () => {
  // checkBackendContinuously();
  // Connect camera
  await window.api.connectCamera();
});

// Function check backend
function checkBackendContinuously() {
  const interval = 3000;
  const checkInterval = setInterval(async () => {
    try {
      response = await window.api.checkBackend();
      if (response.message === "Check backend finish") {
        console.log("✅ Backend is ready.");
        loading.style.display = "none";
        clearInterval(checkInterval);
      }
    } catch (error) {
      console.error("Error checking backend:", error);
    }
  }, interval);
}
// ===================================== Button Trigger =====================================
btnTrigger.addEventListener("click", async () => {
  response = await window.api.trigger();
  const { processed_image_url } = response;
  processedImage.src = processed_image_url;
});
