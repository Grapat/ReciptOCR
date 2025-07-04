export const API_BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:4005"
    : import.meta.env.VITE_API_URL;
