const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Organizador = sequelize.define(
  "Organizador",
  {
    organizadorId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
    },
    senha: {
      type: DataTypes.STRING,
    },
  },
  { tableName: "Organizador", tymestamps: false }
);

sequelize.sync();
module.exports = Organizador;
