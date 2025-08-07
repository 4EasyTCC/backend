require("dotenv").config();
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST, // 'localhost' ou 'localhost\\SQLEXPRESS'
    dialect: "mssql",
    port: process.env.DB_PORT, // Porta 1433
    dialectOptions: {
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    },
    logging: false
  }
);

sequelize
  .authenticate()
  .then(() => console.log("Conectado ao SQL Server"))
  .catch((error) => console.error("Erro ao conectar:", error));

module.exports = sequelize;
