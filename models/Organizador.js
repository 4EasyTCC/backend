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
    avatarUrl: {
      type: DataTypes.STRING,
    },
  },
  { tableName: "Organizador", timestamps: false }
);

module.exports = Organizador;

const Evento = require("./Evento");

Organizador.hasMany(Evento, {
  foreignKey: "organizadorId",
  as: "eventos",
});
