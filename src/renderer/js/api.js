import axios from "axios";

export async function fetchData(endpoint) {
  try {
    const response = await axios.get(`http://localhost:5000/api/${endpoint}`);
    return response.data;
  } catch (error) {
    console.error("Lỗi khi gọi API:", error);
    throw error;
  }
}
