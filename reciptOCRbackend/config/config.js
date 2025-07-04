require("dotenv").config();

module.exports = {
  development: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
  },
  production: {
    // This tells your ORM (like Sequelize) to look for a DATABASE_URL environment variable
    use_env_variable: "DATABASE_URL",
    // You might also have these, but if "use_env_variable" is true,
    // the ORM typically prioritizes the URL.
    username: "admin",
    password: "fLNA2RUHLnLyv4TgBiIYWgK82tBNfOer", // It's better not to hardcode this here if using DATABASE_URL
    database: "egatdb",
    host: "dpg-d1jj822l19vc738o81e0-a",
    port: "5432",
    dialect: "postgres",
    dialectOptions: {
      // Add this for Render's PostgreSQL if you have SSL issues
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};
