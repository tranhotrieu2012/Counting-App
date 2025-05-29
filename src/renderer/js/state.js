export const state = {
  user: null,
  settings: {},
  // Các dữ liệu khác...
};

export function updateUser(newUser) {
  state.user = newUser;
  // Có thể phát sự kiện để các component khác cập nhật giao diện
  const event = new CustomEvent("stateUpdated", { detail: state });
  window.dispatchEvent(event);
}
import { fetchData } from "./api.js";

async function loadSomeData() {
  try {
    const data = await fetchData("some_endpoint");
    console.log(data);
  } catch (error) {
    // Xử lý lỗi
  }
}

loadSomeData();
