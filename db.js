const path = require('path');
require("dotenv").config({ path: path.join(__dirname, '.env') });
const { Sequelize } = require("sequelize");
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASS = process.env.DB_PASS;
let DB_HOST = process.env.DB_HOST;
const DB_PORT = process.env.DB_PORT;
const DB_INSTANCE = process.env.DB_INSTANCE; // optional named instance

// Provide helpful error if required env vars are missing
if (!DB_NAME || !DB_USER || !DB_PASS) {
  console.error('\nMissing required database environment variables.\nPlease create a .env file in backend/ with the following values:');
  console.error('DB_NAME=YourDatabaseName');
  console.error('DB_USER=sa');
  console.error('DB_PASS=YourStrongPassword');
  console.error('DB_HOST=localhost');
  console.error('DB_PORT=1433');
  console.error('DB_INSTANCE=SQLEXPRESS (optional)\n');
  // Do not throw here; allow process to continue so the message is visible.
}

// Support host with instance like 'localhost\\SQLEXPRESS'
let instanceName = DB_INSTANCE || null;
if (DB_HOST && DB_HOST.includes('\\')) {
  const parts = DB_HOST.split('\\');
  DB_HOST = parts[0];
  if (!instanceName && parts[1]) instanceName = parts[1];
}

// Default port
const portNumber = DB_PORT ? parseInt(DB_PORT, 10) : 1433;

const dialectOptions = {
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

// If a named instance is provided, pass it to tedious options
if (instanceName) {
  dialectOptions.options.instanceName = instanceName;
}

const sequelize = new Sequelize(DB_NAME || '', DB_USER || '', DB_PASS || '', {
  host: DB_HOST || 'localhost',
  dialect: "mssql",
  port: portNumber,
  dialectOptions,
  logging: false,
});

sequelize
  .authenticate()
  .then(() => console.log("Conectado ao SQL Server"))
  .catch((error) => console.error("Erro ao conectar:", error));

module.exports = sequelize;
