export const API =
  import.meta.env.MODE === "development"
    ? 'http://localhost:3000'
    : '';
